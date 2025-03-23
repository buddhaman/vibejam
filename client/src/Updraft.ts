import * as THREE from 'three';
import { InstancedRenderer } from './Render';
import { Player, MovementState } from './Player';

export class Updraft {
    private position: THREE.Vector3;
    private size: THREE.Vector3;
    private bounds: THREE.Box3;
    private strength: number;
    private isActive: boolean = true;
    private time: number = 0;

    constructor(
        position: THREE.Vector3,
        size: THREE.Vector3,
        strength: number = 0.1
    ) {
        this.position = position.clone();
        this.size = size.clone();
        this.strength = strength;
        
        // Create bounding box for collision detection
        this.bounds = new THREE.Box3();
        this.updateBounds();
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

    public update(player: Player): void {
        if (!this.isActive) return;
        
        // Check if player is within the updraft area
        const playerPosition = player.getPosition();
        if (this.bounds.containsPoint(playerPosition)) {
            // Force player into InAir state regardless of ground contact
            player.movementState = MovementState.InAir;
            player.notOnGroundTimer = 11; // Ensure it stays above the threshold
            
            // Apply upward force to all particles
            const particles = player.verletBody.getParticles();
            const upwardForce = new THREE.Vector3(0, this.strength, 0);
            
            particles.forEach(particle => {
                // Apply base updraft force
                particle.applyImpulse(upwardForce);
                
                // Add some turbulence
                const turbulenceX = (Math.random() - 0.5) * this.strength * 0.4;
                const turbulenceZ = (Math.random() - 0.5) * this.strength * 0.4;
                particle.applyImpulse(new THREE.Vector3(turbulenceX, 0, turbulenceZ));
            });
        }
    }

    public render(instancedRenderer: InstancedRenderer, deltaTime: number = 0.016): void {
        if (!this.isActive) return;
        
        this.time += deltaTime;
        const baseColor = new THREE.Color(0xaaddff); // Light blue color
        const glowColor = new THREE.Color(0xccffff); // Very light cyan for glow
        
        const beamsPerSide = 6;
        
        // Calculate spacing between beams
        const spacingX = this.size.x / (beamsPerSide - 1);
        const spacingZ = this.size.z / (beamsPerSide - 1);

        // Draw updraft particles and beams
        for (let x = 0; x < beamsPerSide; x++) {
            for (let z = 0; z < beamsPerSide; z++) {
                const startX = this.position.x - this.size.x/2 + x * spacingX;
                const startZ = this.position.z - this.size.z/2 + z * spacingZ;
                
                // Create random height variations
                const heightVariation = Math.sin(this.time * 2 + x * 0.7 + z * 0.9) * 0.5 + 0.5;
                const beamHeight = this.size.y * (0.6 + heightVariation * 0.8);
                
                // Width variations
                const widthPulse = Math.sin(this.time * 3 + x * 0.3 + z * 0.6) * 0.3 + 0.7;
                const beamWidth = 0.2 * widthPulse;
                
                // Start position (on the ground)
                const startPos = new THREE.Vector3(
                    startX + (Math.random() - 0.5) * spacingX * 0.8,
                    this.position.y - this.size.y/2,
                    startZ + (Math.random() - 0.5) * spacingZ * 0.8
                );
                
                // End position (updraft height)
                const endPos = startPos.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 1.2, // Add some horizontal drift
                    beamHeight,
                    (Math.random() - 0.5) * 1.2  // Add some horizontal drift
                ));
                
                // Color intensity based on beam height
                const colorIntensity = 0.6 + heightVariation * 0.4;
                const currentColor = baseColor.clone().multiplyScalar(colorIntensity);
                
                // Render main updraft beam
                instancedRenderer.renderLightBeam(
                    startPos,
                    endPos,
                    beamWidth,
                    beamWidth * 0.3, // Taper the beam toward the top
                    undefined,
                    currentColor,
                    0.6 * widthPulse
                );
                
                // Add small particles along the beam
                const particleCount = 2 + Math.floor(beamHeight * 2);
                for (let p = 0; p < particleCount; p++) {
                    const t = (p / particleCount) * 0.8 + (this.time + x * 0.1 + z * 0.1) % 0.2;
                    const particlePos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
                    
                    // Add some random offset
                    particlePos.x += (Math.random() - 0.5) * 0.3;
                    particlePos.z += (Math.random() - 0.5) * 0.3;
                    
                    // Size based on position in beam
                    const particleSize = 0.05 + (1 - t) * 0.15;
                    
                    // Render particle
                    instancedRenderer.renderSphere(
                        particlePos,
                        particleSize,
                        glowColor.getHex(),
                        0.7
                    );
                }
            }
        }

        // Render ground effect
        const groundEffectSize = Math.min(this.size.x, this.size.z) * 0.5;
        const groundPos = this.position.clone();
        groundPos.y = this.position.y - this.size.y/2 + 0.05;
        const groundScale = 1.1 + Math.sin(this.time * 1.3) * 0.2;
        
        instancedRenderer.renderLightBeam(
            groundPos,
            groundPos.clone().add(new THREE.Vector3(0, 0.3, 0)),
            groundEffectSize * groundScale,
            groundEffectSize * groundScale,
            undefined,
            glowColor,
            0.4
        );
    }

    public checkCollision(point: THREE.Vector3): boolean {
        if (!this.isActive) return false;
        return this.bounds.containsPoint(point);
    }

    public setActive(active: boolean): void {
        this.isActive = active;
    }

    public isActiveState(): boolean {
        return this.isActive;
    }
}
