import * as THREE from 'three';
import { Entity } from './Entity';
import { LevelRenderer } from './LevelRenderer';
import { ConvexShape } from '../../shared/ConvexShape';
import { Body } from 'shared/Body';

export class ActionArea extends Entity {
    public callback: () => void;
    private isActive: boolean = true;
    private time: number = 0;
    public triggerOnce: boolean = true;
    public shape: ConvexShape;

    constructor(
        position: THREE.Vector3,
        size: THREE.Vector3,
        callback: () => void,
        triggerOnce: boolean = false
    ) {
        super();
        // Create unit box and use scale to set size, just like Updraft
        this.shape = ConvexShape.createBox(
            new THREE.Vector3(-0.5, -0.5, -0.5), 
            new THREE.Vector3(0.5, 0.5, 0.5)
        );
        this.shape.setScale(size);
        this.shape.setPosition(position);
        this.shape.updateTransform();

        this.callback = callback;
        this.triggerOnce = triggerOnce;
    }

    public checkCollision(point: THREE.Vector3): boolean {
        if (!this.isActive) return false;
        return this.shape.getBoundingBox().containsPoint(point);
    }

    public getBoundingBox(): THREE.Box3 {
        return this.shape.getBoundingBox();
    }

    public trigger(): void {
        if (this.isActive) {
            this.callback();
            if (this.triggerOnce) {
                this.isActive = false;
            }
        }
    }

    public setActive(active: boolean): void {
        this.isActive = active;
    }

    public isActiveState(): boolean {
        return this.isActive;
    }

    public getShape(): ConvexShape | null {
        return this.shape;
    }

    public shapeChanged(): void {
        if(this.boxCollisionMesh) {
            this.shape.position.copy(this.boxCollisionMesh.position);
        }
        this.shape.updateTransform();
    }

    public render(levelRenderer: LevelRenderer): void {
        if (!this.isActive) return;
        let instancedRenderer = levelRenderer.instancedRenderer;
        this.time += 0.016;
        const baseColor = new THREE.Color(0x00ff88);
        const glowColor = new THREE.Color(0x88ffaa);
        
        // Get bounds and dimensions once
        const bounds = this.shape.getBoundingBox();
        const width = bounds.max.x - bounds.min.x;
        const depth = bounds.max.z - bounds.min.z;
        const height = bounds.max.y - bounds.min.y;
        
        // Reduced number of beams per side
        const beamsPerSide = 5;
        
        // Calculate spacing between beams
        const spacingX = width / (beamsPerSide - 1);
        const spacingZ = depth / (beamsPerSide - 1);

        // Draw beams along the perimeter
        for (let i = 0; i < beamsPerSide; i++) {
            const t = this.time * 2 + i * 0.2;
            const heightScale = 1.0 + Math.sin(t) * 0.4; // Increased height variation
            const widthScale = 0.6 + Math.sin(t * 2) * 0.3; // Increased width pulsing
            const beamHeight = height * 3 * heightScale; // Made beams even taller
            const beamWidth = 0.15 * widthScale; // Increased base width

            // Calculate positions for beams on each side
            const positions = [
                // Front edge
                new THREE.Vector3(
                    bounds.min.x + i * spacingX,
                    bounds.min.y,
                    bounds.min.z
                ),
                // Back edge
                new THREE.Vector3(
                    bounds.min.x + i * spacingX,
                    bounds.min.y,
                    bounds.max.z
                ),
                // Left edge
                new THREE.Vector3(
                    bounds.min.x,
                    bounds.min.y,
                    bounds.min.z + i * spacingZ
                ),
                // Right edge
                new THREE.Vector3(
                    bounds.max.x,
                    bounds.min.y,
                    bounds.min.z + i * spacingZ
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
        const centerPos = new THREE.Vector3(
            (bounds.min.x + bounds.max.x) / 2,
            bounds.min.y + 0.1,
            (bounds.min.z + bounds.max.z) / 2
        );
        const centerScale = 1.2 + Math.sin(this.time * 1.5) * 0.3;

        instancedRenderer.renderLightBeam(
            centerPos,
            centerPos.clone().add(new THREE.Vector3(0, 0.3, 0)),
            width * 0.6 * centerScale,
            depth * 0.6 * centerScale,
            undefined,
            glowColor,
            0.25
        );
    }
}
