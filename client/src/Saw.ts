import * as THREE from 'three';
import { RigidBody } from './RigidBody';
import { ConvexShape } from '../../shared/ConvexShape';

/**
 * Represents a dangerous sawblade obstacle
 */
export class Saw {
    // The physics body
    public body: RigidBody;
    
    // Visual mesh
    public mesh: THREE.Mesh;
    
    // Spinning speed
    public spinSpeed: number;
    
    constructor(
        position: THREE.Vector3,
        radius: number = 1.0,
        thickness: number = 0.2,
        spinSpeed: number = 0.1
    ) {
        this.spinSpeed = spinSpeed;
        
        // Create the physics shape (octagonal prism)
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
        
        // Front and back faces
        const frontIndices: number[] = [];
        const backIndices: number[] = [];
        
        for (let i = 0; i < numVertices; i++) {
            frontIndices.push(i);
            backIndices.push(numVertices + numVertices - 1 - i); // Reverse order for back face
        }
        
        faces.push({indices: frontIndices});
        faces.push({indices: backIndices});
        
        // Side faces
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
        
        // Create the physics shape
        const shape = new ConvexShape(points, faces);
        shape.setPosition(position);
        
        // Create the rigid body with the shape
        const material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x222222,
            emissiveIntensity: 0.2
        });
        
        this.body = new RigidBody(shape, 10.0, material);
        
        // Set initial spin
        this.body.angularVelocity.set(0, 0, spinSpeed);
        
        // Create the visual mesh
        this.createVisualMesh(radius, thickness);
    }
    
    private createVisualMesh(radius: number, thickness: number): void {
        // Create a cylinder for the main disk
        const diskGeometry = new THREE.CylinderGeometry(radius, radius, thickness, 32);
        
        const sawMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x222222,
            emissiveIntensity: 0.2
        });
        
        const diskMesh = new THREE.Mesh(diskGeometry, sawMaterial);
        
        // Create a group for all the saw parts
        const sawGroup = new THREE.Group();
        sawGroup.add(diskMesh);
        
        // Add teeth around the edge
        const toothCount = 16;
        const toothHeight = radius * 0.2;
        const toothWidth = radius * 0.1;
        const toothDepth = thickness * 1.5;
        
        const toothGeometry = new THREE.BoxGeometry(toothWidth, toothHeight, toothDepth);
        const toothMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.2,
            metalness: 0.9,
            emissive: 0x111111,
            emissiveIntensity: 0.1
        });
        
        for (let i = 0; i < toothCount; i++) {
            const angle = (i / toothCount) * Math.PI * 2;
            const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
            
            // Position teeth around the edge
            tooth.position.set(
                Math.cos(angle) * (radius + toothHeight/2),
                Math.sin(angle) * (radius + toothHeight/2),
                0
            );
            
            // Rotate teeth to point outward
            tooth.rotation.z = -angle;
            
            sawGroup.add(tooth);
        }
        
        // Add center hub
        const hubRadius = radius * 0.2;
        const hubGeometry = new THREE.CylinderGeometry(hubRadius, hubRadius, thickness * 1.5, 16);
        const hubMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.3,
            metalness: 0.7
        });
        
        const hub = new THREE.Mesh(hubGeometry, hubMaterial);
        sawGroup.add(hub);
        
        // Create a dummy mesh to hold the group
        const dummyGeometry = new THREE.BufferGeometry();
        const dummyMesh = new THREE.Mesh(dummyGeometry, sawMaterial);
        dummyMesh.add(sawGroup);
        
        this.mesh = dummyMesh;
        
        // Set up shadows
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Update transform
        this.updateMeshTransform();
    }
    
    public update(): void {
        // Maintain constant spin speed
        this.body.angularVelocity.set(0, 0, this.spinSpeed);
        
        // Update physics
        this.body.update();
        
        // Update visual mesh to match physics body
        this.updateMeshTransform();
    }
    
    private updateMeshTransform(): void {
        this.mesh.position.copy(this.body.shape.position);
        this.mesh.quaternion.copy(this.body.shape.orientation);
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
