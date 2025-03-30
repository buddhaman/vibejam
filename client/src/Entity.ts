import * as THREE from 'three';
import { LevelRenderer } from './LevelRenderer';

export class Entity {
    // Center position of bounding box
    public position: THREE.Vector3 = new THREE.Vector3();
    public dims: THREE.Vector3 = new THREE.Vector3();

    constructor() {

    }

    public fixedUpdate(): void {
    }

    public render(renderer: LevelRenderer): void {
    }
}
