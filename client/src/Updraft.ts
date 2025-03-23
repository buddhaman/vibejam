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
        
        // Get player's particles
        const particles = player.verletBody.getParticles();
        let particlesInside = false;
        
        // Check each particle individually and only apply force to those inside
        particles.forEach(particle => {
            if (this.bounds.containsPoint(particle.position)) {
                particlesInside = true;
                
                // Apply gentler updraft force
                const upwardForce = new THREE.Vector3(0, this.strength * 0.8, 0);
                particle.applyImpulse(upwardForce);
                
                // Add subtle turbulence
                const turbulenceX = (Math.random() - 0.5) * this.strength * 0.15;
                const turbulenceZ = (Math.random() - 0.5) * this.strength * 0.15;
                particle.applyImpulse(new THREE.Vector3(turbulenceX, 0, turbulenceZ));
            }
        });
        
        // Only set player to InAir if at least one particle is inside
        if (particlesInside) {
            player.movementState = MovementState.InAir;
            player.notOnGroundTimer = 11;
        }
    }

    public render(instancedRenderer: InstancedRenderer, deltaTime: number = 0.016): void {
        if (!this.isActive) return;
        
        this.time += deltaTime;
        const baseColor = new THREE.Color(0xaaddff); // Light blue color
        
        // Get the dimensions of the updraft
        const minX = this.position.x - this.size.x/2;
        const maxX = this.position.x + this.size.x/2;
        const minY = this.position.y - this.size.y/2;
        const maxY = this.position.y + this.size.y/2;
        const minZ = this.position.z - this.size.z/2;
        const maxZ = this.position.z + this.size.z/2;
        
        // --------- VERTICAL STREAMS ---------
        // Create evenly distributed vertical streams across the entire area
        const streamCountX = 4; // Horizontal grid of streams
        const streamCountZ = 4;
        
        for (let ix = 0; ix < streamCountX; ix++) {
            for (let iz = 0; iz < streamCountZ; iz++) {
                // Calculate position with even distribution + small random offset
                const xPos = minX + (ix + 0.5) * (this.size.x / streamCountX) + (Math.random() - 0.5) * 0.5;
                const zPos = minZ + (iz + 0.5) * (this.size.z / streamCountZ) + (Math.random() - 0.5) * 0.5;
                
                // Create start position at the bottom
                const startPos = new THREE.Vector3(xPos, minY, zPos);
                
                // Divide the height into segments
                const segments = 5;
                let lastPoint = startPos.clone();
                
                // Create a zigzag line going up through the entire height
                for (let i = 1; i <= segments; i++) {
                    // Calculate height percentage
                    const t = i / segments;
                    // Calculate height
                    const height = minY + t * this.size.y;
                    
                    // Add horizontal displacement that increases with height
                    const wavePhase = this.time * 3 + ix * 1.1 + iz * 0.9 + i * 0.2;
                    const waveAmplitude = 0.5 * (1 - Math.pow(t, 2)); // Less movement near the top
                    
                    const nextPoint = new THREE.Vector3(
                        xPos + Math.sin(wavePhase) * waveAmplitude,
                        height,
                        zPos + Math.cos(wavePhase * 0.7) * waveAmplitude
                    );
                    
                    // Width and opacity vary with height
                    const lineWidth = 0.25 * (1 - t * 0.6); // Thinner at top
                    const opacity = 0.3 + t * 0.3; // More visible at top
                    
                    // Draw line segment
                    instancedRenderer.renderLightBeam(
                        lastPoint,
                        nextPoint,
                        lineWidth,
                        lineWidth * 0.8,
                        undefined,
                        baseColor,
                        opacity
                    );
                    
                    lastPoint = nextPoint;
                }
            }
        }
        
        // --------- HORIZONTAL WIND LAYERS ---------
        // Add horizontal wind layers at different heights
        const layerCount = 4;
        for (let i = 0; i < layerCount; i++) {
            // Calculate layer height - distribute throughout the volume
            const layerHeight = minY + (i + 0.5) * (this.size.y / layerCount);
            
            // Direction alternates between layers
            const direction = i % 2 === 0 ? 1 : -1;
            
            // Create horizontal streaks in each layer
            const streakCount = 6;
            for (let j = 0; j < streakCount; j++) {
                // Distribute across the width and length + time-based offset
                const streakPhase = this.time * 2 + j * 1.3 + i * 0.7;
                
                // Calculate start position with time-based movement
                const startX = direction > 0 ? 
                    minX + (Math.sin(streakPhase) * 0.5 + 0.5) * this.size.x : 
                    maxX - (Math.sin(streakPhase) * 0.5 + 0.5) * this.size.x;
                    
                const streakZ = minZ + (Math.cos(streakPhase * 0.7) * 0.4 + 0.5) * this.size.z;
                
                // Create start and end points for the streak
                const startPoint = new THREE.Vector3(startX, layerHeight, streakZ);
                const endPoint = new THREE.Vector3(
                    startX + direction * (1.0 + Math.sin(streakPhase * 1.5) * 0.5) * 2,
                    layerHeight + Math.sin(streakPhase * 2) * 0.2,
                    streakZ + Math.cos(streakPhase * 2) * 0.2
                );
                
                // Width and opacity vary with time
                const pulseFactor = 0.7 + Math.sin(this.time * 3 + j + i * 2) * 0.3;
                
                // Draw the streak
                instancedRenderer.renderLightBeam(
                    startPoint,
                    endPoint,
                    0.15 * pulseFactor,
                    0.05 * pulseFactor,
                    undefined,
                    baseColor,
                    0.3 * pulseFactor
                );
            }
        }
        
        // --------- BOUNDARY INDICATORS ---------
        // Add subtle corner indicators to show the boundaries
        for (let corner = 0; corner < 4; corner++) {
            // Calculate corner positions for the bottom face
            const cornerX = corner % 2 === 0 ? minX : maxX;
            const cornerZ = corner < 2 ? minZ : maxZ;
            
            // Create rising indicators at each corner
            const segments = 3;
            let lastPoint = new THREE.Vector3(cornerX, minY, cornerZ);
            
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                const height = minY + t * Math.min(4.0, this.size.y * 0.3); // Only go up a short distance
                
                // Add subtle inward curve
                const inwardX = (this.position.x - cornerX) * 0.2 * t;
                const inwardZ = (this.position.z - cornerZ) * 0.2 * t;
                
                const nextPoint = new THREE.Vector3(
                    cornerX + inwardX,
                    height,
                    cornerZ + inwardZ
                );
                
                // Pulsing with time
                const pulseOpacity = 0.2 + Math.sin(this.time * 2 + corner) * 0.1;
                
                // Draw indicator
                instancedRenderer.renderLightBeam(
                    lastPoint,
                    nextPoint,
                    0.1,
                    0.05,
                    undefined,
                    baseColor,
                    pulseOpacity
                );
                
                lastPoint = nextPoint;
            }
        }
        
        // --------- GROUND EFFECT ---------
        // Improved ground effect covering the entire bottom face
        const groundEffectSize = Math.max(this.size.x, this.size.z) * 0.65;
        const groundPos = this.position.clone();
        groundPos.y = minY + 0.05;
        
        // Main ground glow
        instancedRenderer.renderLightBeam(
            groundPos,
            groundPos.clone().add(new THREE.Vector3(0, 0.3, 0)),
            groundEffectSize,
            groundEffectSize,
            undefined,
            baseColor,
            0.4
        );
        
        // Add circular wind patterns at the base
        const patternCount = 3;
        for (let i = 0; i < patternCount; i++) {
            const patternPhase = this.time * 1.5 + i * Math.PI * 2 / patternCount;
            const patternSize = 0.5 + Math.sin(patternPhase) * 0.2;
            
            // Place patterns in different locations on the base
            const patternX = this.position.x + Math.sin(patternPhase) * this.size.x * 0.3;
            const patternZ = this.position.z + Math.cos(patternPhase) * this.size.z * 0.3;
            
            const patternPos = new THREE.Vector3(patternX, minY + 0.1, patternZ);
            
            instancedRenderer.renderLightBeam(
                patternPos,
                patternPos.clone().add(new THREE.Vector3(0, 0.2, 0)),
                this.size.x * 0.2 * patternSize,
                this.size.z * 0.2 * patternSize,
                undefined,
                baseColor,
                0.3
            );
        }
        
        // Keep debug lines if needed (can be toggled)
        // this.renderDebugBoundary(instancedRenderer);
    }
    
    /**
     * Render debug lines showing the updraft's boundaries
     */
    private renderDebugBoundary(instancedRenderer: InstancedRenderer): void {
        // Calculate the 8 corners of the bounding box
        const minX = this.position.x - this.size.x/2;
        const maxX = this.position.x + this.size.x/2;
        const minY = this.position.y - this.size.y/2;
        const maxY = this.position.y + this.size.y/2;
        const minZ = this.position.z - this.size.z/2;
        const maxZ = this.position.z + this.size.z/2;
        
        // Define the 8 corners of the bounding box
        const corners = [
            new THREE.Vector3(minX, minY, minZ), // 0: bottom-back-left
            new THREE.Vector3(maxX, minY, minZ), // 1: bottom-back-right
            new THREE.Vector3(maxX, minY, maxZ), // 2: bottom-front-right
            new THREE.Vector3(minX, minY, maxZ), // 3: bottom-front-left
            new THREE.Vector3(minX, maxY, minZ), // 4: top-back-left
            new THREE.Vector3(maxX, maxY, minZ), // 5: top-back-right
            new THREE.Vector3(maxX, maxY, maxZ), // 6: top-front-right
            new THREE.Vector3(minX, maxY, maxZ)  // 7: top-front-left
        ];
        
        // Define the 12 edges of the box by pairs of corner indices
        const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0], // bottom face
            [4, 5], [5, 6], [6, 7], [7, 4], // top face
            [0, 4], [1, 5], [2, 6], [3, 7]  // connecting edges
        ];
        
        // Draw each edge as a beam
        const debugColor = new THREE.Color(0xffff00); // Yellow for visibility
        const lineWidth = 0.05;
        
        edges.forEach(edge => {
            const startCorner = corners[edge[0]];
            const endCorner = corners[edge[1]];
            
            // Use a pulsing effect for the debug lines
            const pulseOpacity = 0.3 + Math.sin(this.time * 2) * 0.15;
            
            instancedRenderer.renderBeam(
                startCorner,
                endCorner,
                lineWidth,
                lineWidth,
                undefined,
                debugColor.getHex(),
                pulseOpacity
            );
        });
        
        // Add height markers at regular intervals
        const verticalMarkers = 4; // Number of height level indicators
        for (let i = 1; i < verticalMarkers; i++) {
            const y = minY + (this.size.y * i / verticalMarkers);
            
            // Draw a horizontal rectangle outline at this height
            const markerCorners = [
                new THREE.Vector3(minX, y, minZ),
                new THREE.Vector3(maxX, y, minZ),
                new THREE.Vector3(maxX, y, maxZ),
                new THREE.Vector3(minX, y, maxZ)
            ];
            
            // Draw the horizontal square
            for (let j = 0; j < 4; j++) {
                const startPoint = markerCorners[j];
                const endPoint = markerCorners[(j+1) % 4];
                
                instancedRenderer.renderBeam(
                    startPoint,
                    endPoint,
                    lineWidth,
                    lineWidth,
                    undefined,
                    debugColor.getHex(),
                    0.2 // Fainter than the main box
                );
            }
        }
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
