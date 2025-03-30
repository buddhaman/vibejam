import * as THREE from 'three';
import { InstancedRenderer } from './Render';
import { Player, MovementState } from './Player';
import { Entity } from './Entity';
import { ConvexShape } from '../../shared/ConvexShape';
import { LevelRenderer } from './LevelRenderer';
import { Body } from 'shared/Body';

export class Updraft extends Entity {
    private strength: number;
    private isActive: boolean = true;
    private time: number = 0;
    public shape: ConvexShape;

    constructor(
        position: THREE.Vector3,
        size: THREE.Vector3,
        strength: number = 0.1
    ) {
        super();
        this.strength = strength;
        // Create unit box and use scale to set size
        this.shape = ConvexShape.createBox(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
        this.shape.setScale(size);
        this.shape.setPosition(position);
        this.shape.updateTransform();
    }

    public getBoundingBox(): THREE.Box3 {
        return this.shape.getBoundingBox();
    }

    public updateForPlayer(player: Player): void {
        if (!this.isActive) return;
        
        // Get player's particles
        const particles = player.getBody().getParticles();
        let particlesInside = false;
        
        // Get bounds for height-based force calculation from this.getBoundingBox()
        const bounds = this.getBoundingBox();
        
        // Check each particle individually and only apply force to those inside
        particles.forEach(particle => {
            if (this.getBoundingBox().containsPoint(particle.position)) {
                particlesInside = true;
                
                // Calculate height percentage (0 at bottom, 1 at top)
                const heightPercent = Math.min(1, Math.max(0, (particle.position.y - bounds.min.y) / (bounds.max.y-bounds.min.y)));
                
                // Scale force based on height - stronger at bottom, weaker at top
                const forceScale = 1.0 - (heightPercent * 0.7); // Scales from 1.0 at bottom to 0.3 at top
                
                // Apply variable updraft force
                const upwardForce = new THREE.Vector3(0, this.strength * forceScale, 0);
                particle.applyImpulse(upwardForce);
                
                // Add subtle turbulence - stronger at bottom
                const turbulenceScale = forceScale * 0.15;
                const turbulenceX = (Math.random() - 0.5) * this.strength * turbulenceScale;
                const turbulenceZ = (Math.random() - 0.5) * this.strength * turbulenceScale;
                particle.applyImpulse(new THREE.Vector3(turbulenceX, 0, turbulenceZ));
            }
        });
        
        // Only set player to InAir if at least one particle is inside
        if (particlesInside) {
            player.movementState = MovementState.InAir;
            player.notOnGroundTimer = 11;
        }
    }

    public render(levelRenderer: LevelRenderer): void {
        if (!this.isActive) return;

        let instancedRenderer = levelRenderer.instancedRenderer;
        
        this.time += 0.016;
        const baseColor = new THREE.Color(0xaaddff); // Light blue color

        let bounds = this.getBoundingBox();
        
        // --------- VERTICAL STREAMS ONLY ---------
        // Create evenly distributed vertical streams across the entire area
        const streamCountX = 5; // Increased number for more coverage
        const streamCountZ = 5;
        
        for (let ix = 0; ix < streamCountX; ix++) {
            for (let iz = 0; iz < streamCountZ; iz++) {
                // Calculate position with even distribution + small random offset
                const xPos = bounds.min.x + (ix + 0.5) * ((bounds.max.x - bounds.min.x) / streamCountX) + (Math.random() - 0.5) * 0.5;
                const zPos = bounds.min.z + (iz + 0.5) * ((bounds.max.z - bounds.min.z) / streamCountZ) + (Math.random() - 0.5) * 0.5;
                
                // Create start position at the bottom
                const startPos = new THREE.Vector3(xPos, bounds.min.y, zPos);
                
                // Divide the height into segments
                const segments = 8; // More segments for smoother curves
                let lastPoint = startPos.clone();
                
                // Create a zigzag line going up through the entire height
                for (let i = 1; i <= segments; i++) {
                    // Calculate height percentage
                    const t = i / segments;
                    // Calculate height
                    const height = bounds.min.y + t * (bounds.max.y - bounds.min.y);
                    
                    // Add horizontal displacement that increases with height
                    const wavePhase = this.time * 2.5 + ix * 1.1 + iz * 0.9 + i * 0.2;
                    const waveAmplitude = 0.5 * (1 - Math.pow(t, 2.5)); // Stronger curve near bottom
                    
                    // Vertical displacement slightly increases with height to show air slowing down
                    const vertOffset = t * 0.7; // Slight offset to make top segments more spaced out
                    
                    const nextPoint = new THREE.Vector3(
                        xPos + Math.sin(wavePhase) * waveAmplitude,
                        height + vertOffset,
                        zPos + Math.cos(wavePhase * 0.7) * waveAmplitude
                    );
                    
                    // Width decreases more aggressively with height to show dissipation
                    // Make air streams thicker by increasing base width from 0.3 to 0.4
                    const lineWidth = 0.4 * Math.pow(1 - t, 1.2); // Thicker at bottom, thinner at top
                    
                    // Opacity varies with height - strong at bottom, fades at top
                    const opacity = 0.5 - t * 0.3;
                    
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
        
        // --------- BOUNDARY INDICATORS ---------
        // Add subtle corner indicators to show the boundaries
        for (let corner = 0; corner < 4; corner++) {
            // Calculate corner positions for the bottom face
            // Fix the incorrect cornerX calculation
            const cornerX = corner % 2 === 0 ? bounds.min.x : bounds.max.x;
            const cornerZ = corner < 2 ? bounds.min.z : bounds.max.z;
            
            // Create rising indicators at each corner
            const segments = 3;
            let lastPoint = new THREE.Vector3(cornerX, bounds.min.y, cornerZ);
            
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                const height = bounds.min.y + t * Math.min(4.0, (bounds.max.y - bounds.min.y) * 0.3); // Only go up a short distance
                
                // Fix the inward curve calculation to properly point toward the center
                const centerX = (bounds.min.x + bounds.max.x) / 2;
                const centerZ = (bounds.min.z + bounds.max.z) / 2;
                const inwardX = (centerX - cornerX) * 0.2 * t;
                const inwardZ = (centerZ - cornerZ) * 0.2 * t;
                
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
        
        // Debug boundary can be toggled if needed
        // this.renderDebugBoundary(instancedRenderer);
    }
    
    /**
     * Render debug lines showing the updraft's boundaries
     */
    // private renderDebugBoundary(instancedRenderer: InstancedRenderer): void {
    //     // Calculate the 8 corners of the bounding box
    //     const minX = this.position.x - this.size.x/2;
    //     const maxX = this.position.x + this.size.x/2;
    //     const minY = this.position.y - this.size.y/2;
    //     const maxY = this.position.y + this.size.y/2;
    //     const minZ = this.position.z - this.size.z/2;
    //     const maxZ = this.position.z + this.size.z/2;
        
    //     // Define the 8 corners of the bounding box
    //     const corners = [
    //         new THREE.Vector3(minX, minY, minZ), // 0: bottom-back-left
    //         new THREE.Vector3(maxX, minY, minZ), // 1: bottom-back-right
    //         new THREE.Vector3(maxX, minY, maxZ), // 2: bottom-front-right
    //         new THREE.Vector3(minX, minY, maxZ), // 3: bottom-front-left
    //         new THREE.Vector3(minX, maxY, minZ), // 4: top-back-left
    //         new THREE.Vector3(maxX, maxY, minZ), // 5: top-back-right
    //         new THREE.Vector3(maxX, maxY, maxZ), // 6: top-front-right
    //         new THREE.Vector3(minX, maxY, maxZ)  // 7: top-front-left
    //     ];
        
    //     // Define the 12 edges of the box by pairs of corner indices
    //     const edges = [
    //         [0, 1], [1, 2], [2, 3], [3, 0], // bottom face
    //         [4, 5], [5, 6], [6, 7], [7, 4], // top face
    //         [0, 4], [1, 5], [2, 6], [3, 7]  // connecting edges
    //     ];
        
    //     // Draw each edge as a beam
    //     const debugColor = new THREE.Color(0xffff00); // Yellow for visibility
    //     const lineWidth = 0.05;
        
    //     edges.forEach(edge => {
    //         const startCorner = corners[edge[0]];
    //         const endCorner = corners[edge[1]];
            
    //         // Use a pulsing effect for the debug lines
    //         const pulseOpacity = 0.3 + Math.sin(this.time * 2) * 0.15;
            
    //         instancedRenderer.renderLightBeam(
    //             startCorner,
    //             endCorner,
    //             lineWidth,
    //             lineWidth,
    //             undefined,
    //             debugColor,
    //             pulseOpacity
    //         );
    //     });
        
    //     // Add height markers at regular intervals
    //     const verticalMarkers = 4; // Number of height level indicators
    //     for (let i = 1; i < verticalMarkers; i++) {
    //         const y = minY + (this.size.y * i / verticalMarkers);
            
    //         // Draw a horizontal rectangle outline at this height
    //         const markerCorners = [
    //             new THREE.Vector3(minX, y, minZ),
    //             new THREE.Vector3(maxX, y, minZ),
    //             new THREE.Vector3(maxX, y, maxZ),
    //             new THREE.Vector3(minX, y, maxZ)
    //         ];
            
    //         // Draw the horizontal square
    //         for (let j = 0; j < 4; j++) {
    //             const startPoint = markerCorners[j];
    //             const endPoint = markerCorners[(j+1) % 4];
                
    //             instancedRenderer.renderBeam(
    //                 startPoint,
    //                 endPoint,
    //                 lineWidth,
    //                 lineWidth,
    //                 undefined,
    //                 debugColor.getHex(),
    //             );
    //         }
    //     }
    // }

    public getBody(): Body {
        return this.shape;
    }

    public setActive(active: boolean): void {
        this.isActive = active;
    }

    public isActiveState(): boolean {
        return this.isActive;
    }
}
