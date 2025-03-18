import * as THREE from 'three';

export class Player {
    public mesh: THREE.Mesh;
    private id: string;
    private position: THREE.Vector3;
    private targetPosition: THREE.Vector3;

    constructor(id: string) {
        this.id = id;
        this.position = new THREE.Vector3();
        this.targetPosition = new THREE.Vector3();

        // Create a simple cube for the player
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ 
            color: id === 'local' ? 0x00ff00 : 0xff0000 
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
    }

    public updatePosition(position: THREE.Vector3): void {
        this.targetPosition.copy(position);
    }

    public update(): void {
        // Smoothly interpolate to target position
        this.position.lerp(this.targetPosition, 0.1);
        this.mesh.position.copy(this.position);
    }
} 