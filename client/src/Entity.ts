import * as THREE from 'three';
import { LevelRenderer } from './LevelRenderer';
import { Body } from '../../shared/Body';
import { ConvexShape } from 'shared/ConvexShape';

export class Entity {
    public boxCollisionMesh: THREE.Mesh | null = null;

    constructor() {

    }

    public fixedUpdate(): void {
    }

    public render(renderer: LevelRenderer): void {
    }

    public getBody(): Body {
        // Print the type of the entity
        console.error("getBody not implemented for Entity " + this.constructor.name);
        return new Body();
    }

    public getBoundingBox(): THREE.Box3 {
        return this.getBody().getBoundingBox() ?? new THREE.Box3();
    }

    // Returns a mesh that can be used for collision detection. 
    // If not overridden, it will create a box mesh that matches the bounding box of the entity.
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

    public getShape() : ConvexShape | null
    {
        return null;
    }

}
