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
    mesh: THREE.Mesh;
    
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
        
        // Create visual mesh
        this.mesh = shape.createMesh(material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
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
     * @param timeStep Time step in seconds
     */
    update(timeStep: number): void {
        // Skip update for static bodies
        if (this.mass <= 0) return;
        
        // Update position
        const deltaPosition = this.velocity.clone().multiplyScalar(timeStep);
        this.shape.position.add(deltaPosition);
        
        // Update rotation (convert angular velocity to quaternion change)
        if (this.angularVelocity.lengthSq() > 0.000001) {
            const angle = this.angularVelocity.length() * timeStep;
            const axis = this.angularVelocity.clone().normalize();
            
            const rotationDelta = new THREE.Quaternion();
            rotationDelta.setFromAxisAngle(axis, angle);
            
            // Apply rotation
            this.shape.orientation.premultiply(rotationDelta);
            this.shape.orientation.normalize(); // Prevent drift
        }
        
        // Update the shape's transform
        this.shape.updateTransform();
        
        // Update the mesh to match the shape
        this.mesh.position.copy(this.shape.position);
        this.mesh.quaternion.copy(this.shape.orientation);
        this.mesh.scale.copy(this.shape.scaling);
    }
    
    /**
     * Apply a force at a point (relative to center of mass)
     * @param force Force vector
     * @param point Point of application (in world space)
     * @param timeStep Time step in seconds
     */
    applyForce(force: THREE.Vector3, point: THREE.Vector3, timeStep: number): void {
        if (this.mass <= 0) return; // Static bodies don't move
        
        // Apply linear acceleration: F = ma -> a = F/m
        const acceleration = force.clone().multiplyScalar(this.invMass);
        this.velocity.add(acceleration.multiplyScalar(timeStep));
        
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
        
        this.angularVelocity.add(angularAcceleration.multiplyScalar(timeStep));
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
        
        // For visual representation, we'll override the mesh in the constructor
        const body = new RigidBody(shape, mass, material);
        
        // Replace the default mesh with a proper sphere geometry
        const sphereGeometry = new THREE.SphereGeometry(radius, segments, segments);
        body.mesh = new THREE.Mesh(sphereGeometry, material);
        body.mesh.position.copy(position);
        body.mesh.castShadow = true;
        body.mesh.receiveShadow = true;
        
        return body;
    }
}
