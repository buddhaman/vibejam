import * as THREE from 'three';
import { InstancedRenderer } from './Render';

export class ActionArea {
    private position: THREE.Vector3;
    private size: THREE.Vector3;
    private bounds: THREE.Box3;
    private callback: () => void;
    private isActive: boolean = true;
    private time: number = 0;

    constructor(
        position: THREE.Vector3,
        size: THREE.Vector3,
        callback: () => void
    ) {
        this.position = position.clone();
        this.size = size.clone();
        
        // Create bounding box for collision detection
        this.bounds = new THREE.Box3();
        this.updateBounds();

        this.callback = callback;
    }

    private updateBounds(): void {
        // Create bounds from position and size
        this.bounds = new THREE.Box3().set(
            new THREE.Vector3(
                this.position.x - this.size.x/2,
                this.position.y - this.size.y/2,
                this.position.z - this.size.z/2
            ),
            new THREE.Vector3(
                this.position.x + this.size.x/2,
                this.position.y + this.size.y/2,
                this.position.z + this.size.z/2
            )
        );
    }

    public render(instancedRenderer: InstancedRenderer, deltaTime: number = 0.016): void {
        if (!this.isActive) return;
        
        this.time += deltaTime;
        const beamColor = new THREE.Color(0x00ff88);
        
        // Number of beams per side
        const beamsPerSide = 6;
        
        // Calculate spacing between beams
        const spacingX = this.size.x / (beamsPerSide - 1);
        const spacingZ = this.size.z / (beamsPerSide - 1);

        // Draw beams along the perimeter
        for (let i = 0; i < beamsPerSide; i++) {
            const t = this.time * 2 + i * 0.2;
            const heightScale = 1.0 + Math.sin(t) * 0.3; // Beam height variation
            const widthScale = 0.5 + Math.sin(t * 2) * 0.2; // Beam width pulsing
            const beamHeight = this.size.y * 2 * heightScale; // Make beams taller than the box
            const beamWidth = 0.1 * widthScale;

            // Calculate positions for beams on each side
            const positions = [
                // Front edge
                new THREE.Vector3(
                    this.position.x - this.size.x/2 + i * spacingX,
                    this.position.y - this.size.y/2,
                    this.position.z - this.size.z/2
                ),
                // Back edge
                new THREE.Vector3(
                    this.position.x - this.size.x/2 + i * spacingX,
                    this.position.y - this.size.y/2,
                    this.position.z + this.size.z/2
                ),
                // Left edge
                new THREE.Vector3(
                    this.position.x - this.size.x/2,
                    this.position.y - this.size.y/2,
                    this.position.z - this.size.z/2 + i * spacingZ
                ),
                // Right edge
                new THREE.Vector3(
                    this.position.x + this.size.x/2,
                    this.position.y - this.size.y/2,
                    this.position.z - this.size.z/2 + i * spacingZ
                )
            ];

            // Render each beam
            positions.forEach((pos, index) => {
                const phaseOffset = index * 0.25 + i * 0.1;
                const colorIntensity = 0.5 + Math.sin(this.time * 3 + phaseOffset) * 0.5;
                const currentColor = beamColor.clone().multiplyScalar(colorIntensity);
                
                instancedRenderer.renderBeam(
                    pos, // Start from ground
                    pos.clone().add(new THREE.Vector3(0, beamHeight, 0)), // Go straight up
                    beamWidth,
                    beamWidth,
                    undefined,
                    currentColor
                );
            });
        }
    }

    public checkCollision(point: THREE.Vector3): boolean {
        if (!this.isActive) return false;
        return this.bounds.containsPoint(point);
    }

    public trigger(): void {
        if (this.isActive) {
            this.callback();
        }
    }

    public setActive(active: boolean): void {
        this.isActive = active;
    }

    public isActiveState(): boolean {
        return this.isActive;
    }
}
