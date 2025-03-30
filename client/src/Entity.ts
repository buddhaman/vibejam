import * as THREE from 'three';
import { LevelRenderer } from './LevelRenderer';
import { Body } from '../../shared/Body';

export class Entity {
    public boxCollisionMesh: THREE.Mesh | null = null;

    constructor() {

    }

    public fixedUpdate(): void {
    }

    public render(renderer: LevelRenderer): void {
    }

    public getBody(): Body {
        console.error("getBody not implemented for Entity");
        return new Body();
    }

    public getBoundingBox(): THREE.Box3 {
        return this.getBody().getBoundingBox() ?? new THREE.Box3();
    }

    public getCollisionMesh(): THREE.Mesh {
        const boundingBox = this.getBoundingBox();
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        if (this.boxCollisionMesh === null) {
            // Create a new box collision mesh
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial({ 
                wireframe: true, 
                visible: false 
            });
            
            this.boxCollisionMesh = new THREE.Mesh(geometry, material);
        }
        
        // Update position and scale to match current bounding box
        this.boxCollisionMesh.position.copy(center);
        this.boxCollisionMesh.scale.copy(size);
        
        return this.boxCollisionMesh;
    }
}
