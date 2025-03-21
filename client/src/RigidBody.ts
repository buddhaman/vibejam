import * as THREE from 'three';
import { ConvexShape } from '../../shared/ConvexShape';

/**
 * Represents a rigid body with physics properties
 */
export class RigidBody {
    // Underlying shape for collision
    shape: ConvexShape;
    
    // Physics properties
    mass: number;
    invMass: number;
    velocity: THREE.Vector3;
    angularVelocity: THREE.Vector3;
    
    // Inertia tensor (simplified as diagonal matrix for basic cases)
    inertia: THREE.Vector3;
    invInertia: THREE.Vector3;
    
    // Visual representation
    mesh: THREE.Mesh = new THREE.Mesh();
    
    /**
     * Create a rigid body
     * @param shape The collision shape
     * @param mass The mass of the body (0 for static/immovable)
     * @param material Material for the mesh
     */
    constructor(shape: ConvexShape, mass: number, material: THREE.Material) {
        this.shape = shape;
        
        // Initialize physics properties
        this.mass = mass;
        this.invMass = mass > 0 ? 1.0 / mass : 0.0;
        this.velocity = new THREE.Vector3();
        this.angularVelocity = new THREE.Vector3();
        
        // Simplified inertia calculation (assuming uniformly dense object)
        this.inertia = this.calculateInertia();
        this.invInertia = new THREE.Vector3(
            this.inertia.x > 0 ? 1.0 / this.inertia.x : 0,
            this.inertia.y > 0 ? 1.0 / this.inertia.y : 0,
            this.inertia.z > 0 ? 1.0 / this.inertia.z : 0
        );
        
        // Create a standard Three.js mesh based on shape type
        if (shape instanceof ConvexShape) {
            // For box shapes, create a BoxGeometry
            if (this.isBoxShape(shape)) {
                const size = this.getBoxSize(shape);
                const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
                this.mesh = new THREE.Mesh(boxGeometry, material);
            }
            // For more complex shapes, use the shape's mesh creation
            else {
                this.mesh = shape.createMesh(material);
                // Reset the mesh to origin - we'll handle transform in syncMeshToShape
                this.mesh.position.set(0, 0, 0);
                this.mesh.quaternion.identity();
            }
        }
        
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Initial sync from shape to mesh
        this.syncMeshToShape();
    }
    
    /**
     * Detect if shape is a box for optimized handling
     */
    private isBoxShape(shape: ConvexShape): boolean {
        return shape.getLocalPoints().length === 8 && shape.faces.length === 6;
    }
    
    /**
     * Get box dimensions from shape
     */
    private getBoxSize(shape: ConvexShape): THREE.Vector3 {
        const localPoints = shape.getLocalPoints();
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        // Find min/max coords
        for (const point of localPoints) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            minZ = Math.min(minZ, point.z);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
            maxZ = Math.max(maxZ, point.z);
        }
        
        return new THREE.Vector3(
            maxX - minX,
            maxY - minY,
            maxZ - minZ
        );
    }
    
    /**
     * Calculate the moment of inertia based on the shape
     * This is a simplified approximation assuming uniform density
     */
    calculateInertia(): THREE.Vector3 {
        if (this.mass <= 0) {
            return new THREE.Vector3(0, 0, 0); // Static bodies have infinite inertia
        }
        
        // Approximate inertia based on bounding sphere
        const radius = this.shape.boundingSphere.radius;
        
        // For a solid sphere, I = 2/5 * m * r²
        // For more complex shapes, we'd need more sophisticated calculations
        const sphereInertia = 0.4 * this.mass * radius * radius;
        
        // Return uniform inertia for now (can be refined later)
        return new THREE.Vector3(sphereInertia, sphereInertia, sphereInertia);
    }
    
    /**
     * Update the rigid body physics
     */
    update(): void {
        // Skip update for static bodies
        if (this.mass <= 0) return;
        
        // Update position with fixed increment
        this.shape.position.add(this.velocity);
        
        // Update rotation with fixed increment
        if (this.angularVelocity.lengthSq() > 0.000001) {
            const rotationDelta = new THREE.Quaternion();
            rotationDelta.setFromAxisAngle(
                this.angularVelocity.clone().normalize(),
                this.angularVelocity.length()
            );
            
            // Apply rotation
            this.shape.orientation.premultiply(rotationDelta);
            this.shape.orientation.normalize(); // Prevent drift
        }
        
        // Update the shape's transform
        this.shape.updateTransform();
        
        // Sync mesh to shape's transform directly
        this.syncMeshToShape();
    }
    
    /**
     * Sync mesh transform to match shape transform exactly
     */
    private syncMeshToShape(): void {
        // Copy transform directly from shape
        this.mesh.position.copy(this.shape.position);
        this.mesh.quaternion.copy(this.shape.orientation);
        this.mesh.scale.copy(this.shape.scaling);
    }
    
    /**
     * Apply a force at a point (relative to center of mass)
     * @param force Force vector
     * @param point Point of application (in world space)
     */
    applyForce(force: THREE.Vector3, point: THREE.Vector3): void {
        if (this.mass <= 0) return; // Static bodies don't move
        
        // Apply linear acceleration: F = ma -> a = F/m
        const acceleration = force.clone().multiplyScalar(this.invMass);
        this.velocity.add(acceleration);
        
        // Calculate torque: τ = r × F
        const relativePos = point.clone().sub(this.shape.position);
        const torque = new THREE.Vector3().crossVectors(relativePos, force);
        
        // Apply angular acceleration: τ = I*α -> α = τ/I
        // For simplified diagonal inertia tensor:
        const angularAcceleration = new THREE.Vector3(
            torque.x * this.invInertia.x,
            torque.y * this.invInertia.y,
            torque.z * this.invInertia.z
        );
        
        this.angularVelocity.add(angularAcceleration);
    }
    
    /**
     * Apply an impulse at a point (instantaneous change in momentum)
     * @param impulse Impulse vector (mass * velocity change)
     * @param point Point of application (in world space)
     */
    applyImpulse(impulse: THREE.Vector3, point: THREE.Vector3): void {
        if (this.mass <= 0) return; // Static bodies don't move
        
        // Apply linear velocity change: J = m*Δv -> Δv = J/m
        this.velocity.add(impulse.clone().multiplyScalar(this.invMass));
        
        // Calculate angular impulse
        const relativePos = point.clone().sub(this.shape.position);
        const angularImpulse = new THREE.Vector3().crossVectors(relativePos, impulse);
        
        // Apply angular velocity change
        this.angularVelocity.add(new THREE.Vector3(
            angularImpulse.x * this.invInertia.x,
            angularImpulse.y * this.invInertia.y,
            angularImpulse.z * this.invInertia.z
        ));
    }
    
    /**
     * Create a box-shaped rigid body
     * @param position Initial position
     * @param size Box size (width, height, depth)
     * @param mass Mass of the box
     * @param material Material for rendering
     */
    static createBox(
        position: THREE.Vector3,
        size: THREE.Vector3,
        mass: number,
        material: THREE.Material
    ): RigidBody {
        // Create box with center at origin
        const halfSize = size.clone().multiplyScalar(0.5);
        const min = new THREE.Vector3(-halfSize.x, -halfSize.y, -halfSize.z);
        const max = new THREE.Vector3(halfSize.x, halfSize.y, halfSize.z);
        
        const shape = ConvexShape.createBox(min, max);
        shape.setPosition(position);
        
        return new RigidBody(shape, mass, material);
    }
    
    /**
     * Create a sphere-shaped rigid body
     * @param position Initial position
     * @param radius Sphere radius
     * @param segments Number of segments (for visual quality)
     * @param mass Mass of the sphere
     * @param material Material for rendering
     */
    static createSphere(
        position: THREE.Vector3,
        radius: number,
        segments: number,
        mass: number,
        material: THREE.Material
    ): RigidBody {
        // Create a basic approximation of a sphere using a convex shape
        const points: THREE.Vector3[] = [];
        const faces: {indices: number[]}[] = [];
        
        // Generate points for icosphere approximation
        const t = (1.0 + Math.sqrt(5.0)) / 2.0;
        
        // 12 vertices of icosahedron
        points.push(new THREE.Vector3(-1, t, 0).normalize().multiplyScalar(radius));
        points.push(new THREE.Vector3(1, t, 0).normalize().multiplyScalar(radius));
        points.push(new THREE.Vector3(-1, -t, 0).normalize().multiplyScalar(radius));
        points.push(new THREE.Vector3(1, -t, 0).normalize().multiplyScalar(radius));
        
        points.push(new THREE.Vector3(0, -1, t).normalize().multiplyScalar(radius));
        points.push(new THREE.Vector3(0, 1, t).normalize().multiplyScalar(radius));
        points.push(new THREE.Vector3(0, -1, -t).normalize().multiplyScalar(radius));
        points.push(new THREE.Vector3(0, 1, -t).normalize().multiplyScalar(radius));
        
        points.push(new THREE.Vector3(t, 0, -1).normalize().multiplyScalar(radius));
        points.push(new THREE.Vector3(t, 0, 1).normalize().multiplyScalar(radius));
        points.push(new THREE.Vector3(-t, 0, -1).normalize().multiplyScalar(radius));
        points.push(new THREE.Vector3(-t, 0, 1).normalize().multiplyScalar(radius));
        
        // 20 faces of icosahedron (triangular faces)
        faces.push({indices: [0, 11, 5]});
        faces.push({indices: [0, 5, 1]});
        faces.push({indices: [0, 1, 7]});
        faces.push({indices: [0, 7, 10]});
        faces.push({indices: [0, 10, 11]});
        
        faces.push({indices: [1, 5, 9]});
        faces.push({indices: [5, 11, 4]});
        faces.push({indices: [11, 10, 2]});
        faces.push({indices: [10, 7, 6]});
        faces.push({indices: [7, 1, 8]});
        
        faces.push({indices: [3, 9, 4]});
        faces.push({indices: [3, 4, 2]});
        faces.push({indices: [3, 2, 6]});
        faces.push({indices: [3, 6, 8]});
        faces.push({indices: [3, 8, 9]});
        
        faces.push({indices: [4, 9, 5]});
        faces.push({indices: [2, 4, 11]});
        faces.push({indices: [6, 2, 10]});
        faces.push({indices: [8, 6, 7]});
        faces.push({indices: [9, 8, 1]});
        
        // Create the shape with the sphere approximation
        const shape = new ConvexShape(points, faces);
        shape.setPosition(position);
        
        // Create the rigid body
        const body = new RigidBody(shape, mass, material);
        
        // Override mesh with a proper sphere geometry
        const sphereGeometry = new THREE.SphereGeometry(radius, segments, segments);
        body.mesh = new THREE.Mesh(sphereGeometry, material);
        
        // Initialize mesh with identity transform - syncMeshToShape will apply the actual transform
        body.mesh.position.set(0, 0, 0);
        body.mesh.quaternion.identity();
        body.mesh.castShadow = true;
        body.mesh.receiveShadow = true;
        
        // Apply initial transform
        body.syncMeshToShape();
        
        return body;
    }
}
