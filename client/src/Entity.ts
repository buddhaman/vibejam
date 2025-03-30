import * as THREE from 'three';
import { LevelRenderer } from './LevelRenderer';
import { Body } from '../../shared/Body';

export class Entity {
    public body: Body | null = null;
    constructor() {

    }

    public fixedUpdate(): void {
    }

    public render(renderer: LevelRenderer): void {
    }

    public getBoundingBox(): THREE.Box3 {
        return this.body?.getBoundingBox() ?? new THREE.Box3();
    }
}
