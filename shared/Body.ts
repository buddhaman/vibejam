import * as THREE from 'three';

export class Body {
    public boundingBox: THREE.Box3 = new THREE.Box3();

    public updateBoundingBox(): void {
    }

    public getBoundingBox(): THREE.Box3 {
        return this.boundingBox;
    }
}

