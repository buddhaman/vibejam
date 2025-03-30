import * as THREE from 'three';
import { Entity } from './Entity';
import { LevelRenderer } from './LevelRenderer';

export class ActionArea extends Entity {
    private position: THREE.Vector3;
    private size: THREE.Vector3;
    private bounds: THREE.Box3;
    private callback: () => void;
    private isActive: boolean = true;
    private time: number = 0;
    private triggerOnce: boolean = true;

    constructor(
        position: THREE.Vector3,
        size: THREE.Vector3,
        callback: () => void,
        triggerOnce: boolean = false
    ) {
        super();
        this.position = position.clone();
        this.size = size.clone();
        
        // Create bounding box for collision detection
        this.bounds = new THREE.Box3();
        this.updateBounds();

        this.callback = callback;
        this.triggerOnce = triggerOnce;
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

    public render(levelRenderer: LevelRenderer): void {
        if (!this.isActive) return;
        let instancedRenderer = levelRenderer.instancedRenderer;
        this.time += 0.016;
        const baseColor = new THREE.Color(0x00ff88);
        const glowColor = new THREE.Color(0x88ffaa);
        
        // Reduced number of beams per side
        const beamsPerSide = 5;
        
        // Calculate spacing between beams
        const spacingX = this.size.x / (beamsPerSide - 1);
        const spacingZ = this.size.z / (beamsPerSide - 1);

        // Draw beams along the perimeter
        for (let i = 0; i < beamsPerSide; i++) {
            const t = this.time * 2 + i * 0.2;
            const heightScale = 1.0 + Math.sin(t) * 0.4; // Increased height variation
            const widthScale = 0.6 + Math.sin(t * 2) * 0.3; // Increased width pulsing
            const beamHeight = this.size.y * 3 * heightScale; // Made beams even taller
            const beamWidth = 0.15 * widthScale; // Increased base width

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

            // Render each beam set
            positions.forEach((pos, index) => {
                const phaseOffset = index * 0.25 + i * 0.1;
                const colorIntensity = 0.6 + Math.sin(this.time * 3 + phaseOffset) * 0.4;
                const currentColor = baseColor.clone().multiplyScalar(colorIntensity);
                
                // Inner solid beam
                instancedRenderer.renderBeam(
                    pos,
                    pos.clone().add(new THREE.Vector3(0, beamHeight * 0.8, 0)),
                    beamWidth * 0.4,
                    beamWidth * 0.4,
                    undefined,
                    currentColor
                );

                // Outer glowing beam (made wider)
                const glowOpacity = 0.4 + Math.sin(this.time * 2 + phaseOffset) * 0.2;
                instancedRenderer.renderLightBeam(
                    pos,
                    pos.clone().add(new THREE.Vector3(0, beamHeight, 0)),
                    beamWidth * 3,
                    beamWidth * 3,
                    undefined,
                    glowColor,
                    glowOpacity
                );

                // Larger ground glow effect
                const groundGlowSize = 0.5 + Math.sin(this.time * 4 + phaseOffset) * 0.2;
                instancedRenderer.renderLightBeam(
                    pos.clone().add(new THREE.Vector3(0, 0.05, 0)),
                    pos.clone().add(new THREE.Vector3(0, 0.2, 0)),
                    groundGlowSize * 2,
                    groundGlowSize * 2,
                    undefined,
                    glowColor,
                    0.3
                );

                // Fewer but larger floating particles
                const particleCount = 2;
                for (let p = 0; p < particleCount; p++) {
                    const particlePhase = this.time * 3 + p * Math.PI * 2 / particleCount + phaseOffset;
                    const particleHeight = (Math.sin(particlePhase) * 0.5 + 0.5) * beamHeight;
                    const particleOffset = new THREE.Vector3(
                        Math.sin(particlePhase * 1.5) * beamWidth * 2,
                        particleHeight,
                        Math.cos(particlePhase * 1.5) * beamWidth * 2
                    );
                    
                    const particlePos = pos.clone().add(particleOffset);
                    instancedRenderer.renderLightBeam(
                        particlePos,
                        particlePos.clone().add(new THREE.Vector3(0, 0.2, 0)),
                        0.1,
                        0.1,
                        undefined,
                        glowColor,
                        0.7
                    );
                }
            });
        }

        // Larger central area effect
        const centerPos = this.position.clone();
        centerPos.y = this.position.y - this.size.y/2 + 0.1;
        const centerScale = 1.2 + Math.sin(this.time * 1.5) * 0.3;
        instancedRenderer.renderLightBeam(
            centerPos,
            centerPos.clone().add(new THREE.Vector3(0, 0.3, 0)),
            this.size.x * 0.6 * centerScale,
            this.size.z * 0.6 * centerScale,
            undefined,
            glowColor,
            0.25
        );
    }

    public checkCollision(point: THREE.Vector3): boolean {
        if (!this.isActive) return false;
        return this.bounds.containsPoint(point);
    }

    public trigger(): void {
        if (this.isActive) {
            this.callback();
            if (this.triggerOnce) {
                this.isActive = false;
            }
        }
    }

    public getBoundingBox(): THREE.Box3 {
        return this.bounds;
    }

    public setActive(active: boolean): void {
        this.isActive = active;
    }

    public isActiveState(): boolean {
        return this.isActive;
    }
}
