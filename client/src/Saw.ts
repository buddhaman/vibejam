import * as THREE from 'three';
import { RigidBody } from './RigidBody';
import { ConvexShape } from '../../shared/ConvexShape';
import { Entity } from './Entity';

/**
 * Represents a dangerous sawblade obstacle that behaves like a regular rigid body
 */
export class Saw extends Entity {
    // The physics body
    public body: RigidBody;
    
    // Reference to the mesh (directly from RigidBody)
    public mesh: THREE.Mesh;
    
    // Spinning speed
    public spinSpeed: number;
    
    constructor(
        position: THREE.Vector3,
        radius: number = 1.0,
        thickness: number = 0.2,
        spinSpeed: number = 0.1
    ) {
        super();
        this.spinSpeed = spinSpeed;
        
        // Create the octagonal prism shape (centered at origin)
        const points: THREE.Vector3[] = [];
        const numVertices = 8; // Octagon
        
        // Create the octagonal points (front face)
        for (let i = 0; i < numVertices; i++) {
            const angle = (i / numVertices) * Math.PI * 2;
            points.push(new THREE.Vector3(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                thickness / 2
            ));
        }
        
        // Create the octagonal points (back face)
        for (let i = 0; i < numVertices; i++) {
            const angle = (i / numVertices) * Math.PI * 2;
            points.push(new THREE.Vector3(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                -thickness / 2
            ));
        }
        
        // Create faces for the octagon
        const faces: {indices: number[]}[] = [];
        
        // Front face - INVERTED winding order
        for (let i = 1; i < numVertices - 1; i++) {
            faces.push({
                indices: [0, i + 1, i]  // Changed from [0, i, i+1]
            });
        }
        
        // Back face - INVERTED winding order
        for (let i = 1; i < numVertices - 1; i++) {
            faces.push({
                indices: [numVertices, numVertices + i, numVertices + i + 1]  // Changed from [numVertices, numVertices+i+1, numVertices+i]
            });
        }
        
        // Side faces - keep unchanged
        for (let i = 0; i < numVertices; i++) {
            const next = (i + 1) % numVertices;
            faces.push({
                indices: [
                    i,
                    next,
                    numVertices + next,
                    numVertices + i
                ]
            });
        }
        
        // Create the physics shape (centered at origin)
        const shape = new ConvexShape(points, faces);
        
        // Create material for the saw
        const material = new THREE.MeshStandardMaterial({
            color: 0xeeeeee, // Red color for danger
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x441111,
            emissiveIntensity: 0.3
        });
        
        // Create the rigid body (shape is centered at origin)
        this.body = new RigidBody(shape, 10.0, material);
        
        // Position the body after creation (avoids double transformation)
        this.body.shape.position.copy(position);
        this.body.shape.updateTransform();
        
        // Set initial spin
        this.body.angularVelocity.set(0, 0, spinSpeed);
        
        // Use the rigid body's mesh directly
        this.mesh = this.body.mesh;
        
        // Set up shadows
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }
    
    public update(): void {
        // Maintain constant spin speed
        this.body.angularVelocity.set(0, 0, this.spinSpeed);
        
        // Update physics (let the rigid body handle all transformations)
        this.body.update();
    }

    public getCollisionMesh(): THREE.Mesh {
        return this.mesh;
    }

    public getBody(): ConvexShape {
        return this.body.shape;
    }

    public getBoundingBox(): THREE.Box3 {
        return this.body.getBoundingBox();
    }
    
    static create(
        position: THREE.Vector3,
        radius: number = 1.0,
        thickness: number = 0.2,
        spinSpeed: number = 0.1
    ): Saw {
        return new Saw(position, radius, thickness, spinSpeed);
    }
}
