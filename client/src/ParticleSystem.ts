import * as THREE from 'three';
import { InstancedRenderer } from './Render';

/**
 * A single particle in the particle system
 */
interface Particle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    radius: number;
    startRadius: number;
    color: THREE.Color;
    lifetime: number;
    maxLifetime: number;
    gravity: boolean;
    elongationFactor: number; // Add control over elongation amount
}

/**
 * Options for spawning a new particle
 */
interface ParticleOptions {
    position: THREE.Vector3;
    velocity?: THREE.Vector3;
    radius?: number;
    color?: THREE.Color | number;
    lifetime?: number;
    gravity?: boolean;
    elongationFactor?: number; // Add control over elongation amount
}

/**
 * Manages and renders a system of particles with velocity and lifetime
 */
export class ParticleSystem {
    private particles: Particle[] = [];
    private tempVector: THREE.Vector3 = new THREE.Vector3();
    private tempColor: THREE.Color = new THREE.Color();
    private gravity: THREE.Vector3 = new THREE.Vector3(0, -9.8, 0);
    
    /**
     * Create a new particle system
     */
    constructor() {
        // No longer storing renderer
    }
    
    /**
     * Spawn a new particle
     * @param options Options for the new particle
     */
    public spawnParticle(options: ParticleOptions): void {
        // Set default values for optional parameters
        const velocity = options.velocity ?? new THREE.Vector3(0, 0, 0);
        // EXTREME: Much larger default radius (5x bigger)
        const radius = options.radius ?? 0.5;
        let color: THREE.Color;
        
        if (options.color instanceof THREE.Color) {
            color = options.color.clone();
        } else if (typeof options.color === 'number') {
            color = new THREE.Color(options.color);
        } else {
            color = new THREE.Color(0xffffff);
        }
        
        // EXTREME: Much longer default lifetime (4x longer)
        const lifetime = options.lifetime ?? 4.0;
        const gravity = options.gravity ?? false;
        // EXTREME: Higher default elongation factor
        const elongationFactor = options.elongationFactor ?? 4.0;
        
        // Create the particle
        this.particles.push({
            position: options.position.clone(),
            velocity: velocity.clone(),
            radius: radius,
            startRadius: radius,
            color: color,
            lifetime: lifetime,
            maxLifetime: lifetime,
            gravity: gravity,
            elongationFactor: elongationFactor
        });
    }
    
    /**
     * Spawn multiple particles in a burst
     * @param count Number of particles to spawn
     * @param baseOptions Base options for all particles
     * @param randomizeVelocity How much to randomize velocity from the base
     * @param randomizeRadius Range to randomize radius [baseRadius - range, baseRadius + range]
     * @param randomizeLifetime Range to randomize lifetime [baseLifetime - range, baseLifetime + range]
     */
    public spawnParticleBurst(
        count: number,
        baseOptions: ParticleOptions,
        randomizeVelocity: number = 0.5,
        randomizeRadius: number = 0.05,
        randomizeLifetime: number = 0.2
    ): void {
        for (let i = 0; i < count; i++) {
            // Clone the base options
            const options: ParticleOptions = {
                position: baseOptions.position.clone(),
                velocity: baseOptions.velocity?.clone() ?? new THREE.Vector3(0, 0, 0),
                // EXTREME: Much larger default radius
                radius: baseOptions.radius ?? 0.5,
                color: baseOptions.color ?? 0xffffff,
                // EXTREME: Much longer default lifetime
                lifetime: baseOptions.lifetime ?? 4.0,
                gravity: baseOptions.gravity ?? false,
                elongationFactor: baseOptions.elongationFactor ?? 4.0
            };
            
            // EXTREME: More random velocity variation
            if (options.velocity) {
                options.velocity.x += (Math.random() - 0.5) * randomizeVelocity * 4;
                options.velocity.y += (Math.random() - 0.5) * randomizeVelocity * 4;
                options.velocity.z += (Math.random() - 0.5) * randomizeVelocity * 4;
            }
            
            // EXTREME: More random radius variation
            if (options.radius) {
                options.radius += (Math.random() - 0.5) * randomizeRadius * 4;
                // Make sure radius doesn't go negative
                options.radius = Math.max(0.05, options.radius);
            }
            
            // Randomize lifetime
            if (options.lifetime) {
                options.lifetime += (Math.random() - 0.5) * randomizeLifetime * 2;
                // Make sure lifetime doesn't go negative
                options.lifetime = Math.max(0.1, options.lifetime);
            }
            
            // Spawn the particle
            this.spawnParticle(options);
        }
    }
    
    /**
     * Update all particles
     * @param deltaTime Time in seconds since last update
     */
    public update(deltaTime: number): void {
        // Keep only particles with positive lifetime
        this.particles = this.particles.filter(particle => {
            // Update lifetime
            particle.lifetime -= deltaTime;
            
            // Remove if lifetime is up
            if (particle.lifetime <= 0) {
                return false;
            }
            
            // Update position based on velocity
            this.tempVector.copy(particle.velocity).multiplyScalar(deltaTime);
            particle.position.add(this.tempVector);
            
            // Apply gravity if needed
            if (particle.gravity) {
                this.tempVector.copy(this.gravity).multiplyScalar(deltaTime);
                particle.velocity.add(this.tempVector);
            }
            
            return true;
        });
    }
    
    /**
     * Render all particles
     * @param renderer The instanced renderer to use for rendering
     */
    public render(renderer: InstancedRenderer): void {
        for (const particle of this.particles) {
            // Calculate current radius based on remaining lifetime
            // EXTREME: Use a non-linear falloff for more dramatic effect
            const lifeRatio = particle.lifetime / particle.maxLifetime;
            // Particles stay big longer, then shrink rapidly at the end
            const sizeCurve = Math.pow(lifeRatio, 0.3); // Slower decay
            const currentRadius = particle.startRadius * sizeCurve;
            
            // Fade alpha based on lifetime
            const alpha = lifeRatio;
            
            // EXTREME: Longer streaks for faster particles
            const speed = particle.velocity.length();
            const speedFactor = Math.min(1.0, speed / 10); // Normalize speed effect
            
            // Calculate elongation - more dramatic based on speed and custom factor
            const elongation = particle.elongationFactor * speedFactor;
            
            // Render the particle as an elongated sphere
            renderer.renderElongatedSphere(
                particle.position,
                particle.velocity,
                currentRadius,
                elongation,
                particle.color
            );
        }
    }
    
    /**
     * Get the current particle count
     */
    public getParticleCount(): number {
        return this.particles.length;
    }
    
    /**
     * Clear all particles
     */
    public clear(): void {
        this.particles = [];
    }
}
