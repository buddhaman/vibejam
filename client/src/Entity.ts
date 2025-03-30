import * as THREE from 'three';
import { LevelRenderer } from './LevelRenderer';
import { Body } from '../../shared/Body';

export class Entity {
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
}
