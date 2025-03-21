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
}

/**
 * Manages and renders a system of particles with velocity and lifetime
 */
export class ParticleSystem {
    private particles: Particle[] = [];
    private renderer: InstancedRenderer;
    private tempVector: THREE.Vector3 = new THREE.Vector3();
    private tempColor: THREE.Color = new THREE.Color();
    private gravity: THREE.Vector3 = new THREE.Vector3(0, -9.8, 0);
    
    /**
     * Create a new particle system
     * @param renderer The instanced renderer to use for rendering
     */
    constructor(renderer: InstancedRenderer) {
        this.renderer = renderer;
    }
    
    /**
     * Spawn a new particle
     * @param options Options for the new particle
     */
    public spawnParticle(options: ParticleOptions): void {
        // Set default values for optional parameters
        const velocity = options.velocity ?? new THREE.Vector3(0, 0, 0);
        const radius = options.radius ?? 0.1;
        let color: THREE.Color;
        
        if (options.color instanceof THREE.Color) {
            color = options.color.clone();
        } else if (typeof options.color === 'number') {
            color = new THREE.Color(options.color);
        } else {
            color = new THREE.Color(0xffffff);
        }
        
        const lifetime = options.lifetime ?? 1.0;
        const gravity = options.gravity ?? false;
        
        // Create the particle
        this.particles.push({
            position: options.position.clone(),
            velocity: velocity.clone(),
            radius: radius,
            startRadius: radius,
            color: color,
            lifetime: lifetime,
            maxLifetime: lifetime,
            gravity: gravity
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
                radius: baseOptions.radius ?? 0.1,
                color: baseOptions.color ?? 0xffffff,
                lifetime: baseOptions.lifetime ?? 1.0,
                gravity: baseOptions.gravity ?? false
            };
            
            // Randomize velocity
            if (options.velocity) {
                options.velocity.x += (Math.random() - 0.5) * randomizeVelocity * 2;
                options.velocity.y += (Math.random() - 0.5) * randomizeVelocity * 2;
                options.velocity.z += (Math.random() - 0.5) * randomizeVelocity * 2;
            }
            
            // Randomize radius
            if (options.radius) {
                options.radius += (Math.random() - 0.5) * randomizeRadius * 2;
                // Make sure radius doesn't go negative
                options.radius = Math.max(0.01, options.radius);
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
     */
    public render(): void {
        for (const particle of this.particles) {
            // Calculate current radius based on remaining lifetime
            const lifeRatio = particle.lifetime / particle.maxLifetime;
            const currentRadius = particle.startRadius * lifeRatio;
            
            // Fade alpha based on lifetime
            const alpha = lifeRatio;
            
            // Scale elongation factor inversely with lifeRatio - more elongated when faster and newer
            const elongationFactor = 0.5 * (1 + lifeRatio);
            
            // Render the particle as an elongated sphere
            this.renderer.renderElongatedSphere(
                particle.position,
                particle.velocity,
                currentRadius,
                elongationFactor,
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
