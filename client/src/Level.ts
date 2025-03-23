// Level class with logic for handling level. No rendering. No refernce to Game class.

import * as THREE from 'three';
import { LevelRenderer } from "./LevelRenderer";
import { ParticleSystem } from "./ParticleSystem";
import { Player } from "./Player";
import { RigidBody } from "./RigidBody";
import { Rope } from "./Rope";
import { Saw } from "./Saw";
import { StaticBody } from "./StaticBody";
import { TestLevels } from "./TestLevels";

// Split into pure logic such that it can be used in the backend when online mode.
export class Level {

    // Static bodies collection for collision detection
    public staticBodies: StaticBody[] = [];

    // Dynamic bodies collection (similar to static bodies)
    public dynamicBodies: RigidBody[] = [];

    // Add rope collection to Game class
    public ropes: Rope[] = [];

    // Saw blades collection
    public saws: Saw[] = [];

    // Add particle system
    public particleSystem: ParticleSystem;

    public levelRenderer: LevelRenderer | null = null;

    // Players collection
    public players: Map<string, Player>;

    // Local player
    public localPlayer: Player | null;

    constructor() {
        // Initialize particle system
        this.particleSystem = new ParticleSystem();

        this.players = new Map();
        this.localPlayer = null;

        TestLevels.createJungleGymTest(this);
    }

    /**
     * Add a static body to the game
     * @param body The static body to add
     * @returns The added static body
     */
    public addStaticBody(body: StaticBody): StaticBody {
        this.staticBodies.push(body);
        this.levelRenderer?.scene.add(body.mesh);
        return body;
    }

    public addPlayer(id: string, isLocal: boolean = false): Player {
        const player = new Player(id);
        this.players.set(id, player);
        
        // Move player to start on high platform if it's the local player
        if (isLocal) {
            player.move(new THREE.Vector3(0, 5, 0)); // Position above the platform
            this.localPlayer = player;
            
            // Also update camera target to the high platform
            //this.cameraTarget.set(0, 105, 0);
        }

        return player;
    }

    public removePlayer(id: string): void {
        const player = this.players.get(id);
        if (player) {
            this.players.delete(id);
        }
    }
    
    public getPlayer(id: string): Player | undefined {
        return this.players.get(id);
    }

    public fixedUpdate(inputs: {
        playerForward: THREE.Vector3,
        playerInput: {
            w: boolean,
            a: boolean,
            s: boolean,
            d: boolean,
            space: boolean,
            shift: boolean
        }
    }): void {
        // Update the local player's forward vector and handle input
        if (this.localPlayer) {
            this.localPlayer.forward.copy(inputs.playerForward).normalize();
            this.localPlayer.handleInput(inputs.playerInput);
        }

        // Update all players
        this.players.forEach(player => {
            player.fixedUpdate();
            
            // Add rope interaction check
            this.checkPlayerRopeInteraction(player, inputs.playerInput.space);
            
            // Check collisions with static bodies after player movement
            this.checkPlayerCollisions(player);
        });
        
        
        this.players.forEach(player => player.setDebugMode(true));
        
        // Update all dynamic bodies with fixed timestep
        this.updateDynamicBodies();
        
        // Check player collisions with dynamic bodies
        this.players.forEach(player => {
            // Check collisions with static bodies (existing code)
            this.checkPlayerCollisions(player);
            
            // Check collisions with dynamic bodies (new code)
            this.checkPlayerDynamicBodyCollisions(player);
            
            // Check collisions with saws
            this.checkPlayerSawCollisions(player);
        });

        // Update and render all ropes
        this.ropes.forEach(rope => {
            rope.update();
        });

        // Update the circular path for moving saws
        this.updateSawPaths();

        // Update particles with fixed timestep (convert milliseconds to seconds)
        this.particleSystem.update(0.016);
    }

    /**
     * Check and resolve player collisions with static bodies
     * @param player The player to check collisions for
     */
    public checkPlayerCollisions(player: Player): void {
        // Get all particles from the player's verlet body
        const particles = player.verletBody.getParticles();
        
        // Check collision for each particle against each static body
        for (const particle of particles) {
            // Use the particle's position and radius for collision detection
            const particlePosition = particle.position;
            const particleRadius = particle.radius;
            
            // Check collision with each static body
            for (const body of this.staticBodies) {
                const translation = body.collideWithSphere(particlePosition, particleRadius);
                
                // If collision detected, resolve it
                if (translation) {
                    // Move the particle out of collision using the MTV
                    particlePosition.add(translation);
                    
                    // Compute velocity vector
                    const velocity = new THREE.Vector3().subVectors(
                        particlePosition,
                        particle.previousPosition
                    );
                    
                    // Get the normal from the translation vector
                    const normal = translation.clone().normalize();
                    
                    // Project velocity onto normal and tangent planes
                    const velAlongNormal = velocity.dot(normal);
                    const normalComponent = normal.clone().multiplyScalar(velAlongNormal);
                    const tangentComponent = velocity.clone().sub(normalComponent);
                    
                    // Apply friction to tangential component
                    const friction = 0.2; // Friction coefficient (1 = no friction, 0 = full friction)
                    tangentComponent.multiplyScalar(friction);
                    
                    // New velocity is just the tangential component (no bounce)
                    const newVelocity = tangentComponent;
                    
                    // Update the previous position to create this new velocity
                    particle.previousPosition.copy(particlePosition).sub(newVelocity);
                }
            }
        }
    }

    /**
     * Update all dynamic bodies - always using fixed timestep
     */
    private updateDynamicBodies(): void {
        this.dynamicBodies.forEach(body => {
            // Update physics with no timestep parameter
            body.update();
            
            // Apply constraints and boundaries
            this.applyDynamicBodyBoundaries(body);
        });
        
        // Update all saws
        this.saws.forEach(saw => {
            saw.update();
        });
    }
    
    /**
     * Apply boundary conditions to dynamic bodies to create movement patterns
     */
    private applyDynamicBodyBoundaries(body: RigidBody): void {
        const pos = body.shape.position;
        
        // Use constant velocities - never scaled by deltaTime
        const HORIZONTAL_VELOCITY = 0.05;
        const VERTICAL_VELOCITY = 0.04;
        const ROTATION_VELOCITY = 0.02;
        const FAST_ROTATION_VELOCITY = 0.1;
        
        // For horizontal moving platforms - reverse at x boundaries
        if (Math.abs(body.velocity.x) > 0.01 && Math.abs(body.velocity.y) < 0.01) {
            if (Math.abs(pos.x) > 12) {
                // Always use a constant velocity when reversing direction
                body.velocity.x = (body.velocity.x > 0) ? -HORIZONTAL_VELOCITY : HORIZONTAL_VELOCITY;
            }
        }
        
        // For vertical moving platforms - reverse at y boundaries
        if (Math.abs(body.velocity.y) > 0.01 && Math.abs(body.velocity.x) < 0.01) {
            if (pos.y < 2.2 || pos.y > 6) {
                // Always use a constant velocity when reversing direction
                body.velocity.y = (body.velocity.y > 0) ? -VERTICAL_VELOCITY : VERTICAL_VELOCITY;
            }
        }
        
        // Keep all platforms within general bounds
        const generalBounds = 15;
        if (Math.abs(pos.x) > generalBounds || Math.abs(pos.z) > generalBounds || pos.y < 1 || pos.y > 15) {
            // Reset position if it gets too far away
            body.shape.position.set(0, 3, 0);
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.shape.updateTransform();
        }
        
        // Special handling for the X-axis flipping platform
        // If this is the flipping platform (identified by rotation on X axis)
        if (Math.abs(body.angularVelocity.x) > 0.04) {
            // Keep it in place in Z position and don't change its rotation speed
            body.velocity.set(0, 0, 0); // Make it stay in one place
            
            // Make sure it maintains the fast rotation - might get dampened otherwise
            if (Math.abs(body.angularVelocity.x) < FAST_ROTATION_VELOCITY) {
                body.angularVelocity.x = (body.angularVelocity.x > 0) ? 
                    FAST_ROTATION_VELOCITY : -FAST_ROTATION_VELOCITY;
            }
        }
    }
    
    /**
     * Check and resolve player collisions with dynamic bodies
     * @param player The player to check collisions for
     */
    public checkPlayerDynamicBodyCollisions(player: Player): void {
        // Get all particles from the player's verlet body
        const particles = player.verletBody.getParticles();
        
        // Check collision for each particle against each dynamic body
        for (const particle of particles) {
            const particlePosition = particle.position;
            const particleRadius = particle.radius;
            
            // Check against all dynamic bodies
            for (const body of this.dynamicBodies) {
                const translation = body.shape.collideWithSphere(particlePosition, particleRadius);
                
                // If collision detected, resolve it
                if (translation) {
                    // Move the particle out of collision using the translation vector
                    particlePosition.add(translation);
                    
                    // Compute particle velocity
                    const particleVelocity = new THREE.Vector3().subVectors(
                        particlePosition,
                        particle.previousPosition
                    );
                    
                    // Get the normal from the translation vector
                    const normal = translation.clone().normalize();
                    
                    // Project velocity onto normal and tangent planes
                    const velAlongNormal = particleVelocity.dot(normal);
                    const normalComponent = normal.clone().multiplyScalar(velAlongNormal);
                    const tangentComponent = particleVelocity.clone().sub(normalComponent);
                    
                    // Calculate dynamic body velocity at the contact point
                    const bodyVelocity = new THREE.Vector3().copy(body.velocity);
                    
                    // Add angular velocity contribution
                    const contactPoint = particlePosition.clone().sub(translation);
                    const relativePos = contactPoint.clone().sub(body.shape.position);
                    const angularComponent = new THREE.Vector3().crossVectors(
                        body.angularVelocity,
                        relativePos
                    );
                    bodyVelocity.add(angularComponent);
                    
                    // Calculate rebound velocity with some bounce
                    const restitution = 0.0; // 0=no bounce, 1=full bounce
                    const newNormalVelocity = normal.clone().multiplyScalar(-velAlongNormal * restitution);
                    
                    // FIXED: Better blending of velocities with proper friction
                    // First compute the relative tangential velocity
                    const bodyTangentialVel = bodyVelocity.clone().projectOnPlane(normal);
                    const relativeTangentialVel = tangentComponent.clone().sub(bodyTangentialVel);
                    
                    // Apply friction to the relative tangential velocity
                    const friction = 0.2; // Lower value = higher friction
                    relativeTangentialVel.multiplyScalar(friction);
                    
                    // Final tangential velocity = platform velocity + dampened relative velocity
                    const finalTangentialVel = bodyTangentialVel.clone().add(relativeTangentialVel);
                    
                    // Combine normal and tangential components
                    const newParticleVelocity = finalTangentialVel.clone().add(newNormalVelocity);
                    
                    // Update the previous position to create this new velocity
                    particle.previousPosition.copy(particlePosition).sub(newParticleVelocity);
                }
            }
        }
    }

    /**
     * Add a dynamic body to the game
     * @param body The dynamic body to add
     * @returns The added dynamic body
     */
    public addDynamicBody(body: RigidBody): RigidBody {
        this.dynamicBodies.push(body);
        this.levelRenderer?.scene.add(body.mesh);
        return body;
    }

    /**
     * Create several dynamic platforms
     */
    /**
     * Add a rope to the game
     * @param fixedPoint The point where the rope is attached
     * @param segments Number of segments in the rope
     * @param length Total length of the rope
     * @param radius Radius of each rope particle
     * @param color Color of the rope
     * @returns The created rope
     */
    public addRope(
        fixedPoint: THREE.Vector3,
        segments: number = 10,
        length: number = 5,
        radius: number = 0.1,
        color: number = 0xff0000
    ): Rope {
        const rope = new Rope(fixedPoint, segments, length, radius);
        this.ropes.push(rope);
        return rope;
    }

    // Add method to get rope by index
    public getRope(index: number): Rope | undefined {
        if (index >= 0 && index < this.ropes.length) {
            return this.ropes[index];
        }
        return undefined;
    }

    public checkPlayerRopeInteraction(player: Player, spacePressed: boolean): void {
        const playerPos = player.getPosition();
        const interactionRadius = 3.0; // How close player needs to be to grab rope
        
        // If player already has a rope, don't check for new ones
        if (player.rope) return;
        
        // Only continue if space is pressed (either keyboard or mobile)
        if (!spacePressed) return;
        
        // Check each rope's end position against player position
        for (const rope of this.ropes) {
            const ropeEndPos = rope.getEndPosition();
            const distanceToRope = playerPos.distanceTo(ropeEndPos);
            
            if (distanceToRope < interactionRadius) {
                player.rope = rope;
                console.log("Player grabbed rope with spacebar!");
                break;
            }
        }
    }

    /**
     * Create dangerous saw blades
     */
    public createSaws(): void {
        // Create a single test saw
        const testSaw = new Saw(
            new THREE.Vector3(10, 8, 0),  // Position
            4.0,                          // Radius
            0.8,                          // Thickness
            0.05                           // Spin speed
        );
        this.addSaw(testSaw);
    }
    
    /**
     * Add a saw to the game
     * @param saw The saw to add
     * @returns The added saw
     */
    public addSaw(saw: Saw): Saw {
        this.saws.push(saw);
        this.levelRenderer?.scene.add(saw.mesh);
        return saw;
    }
    
    /**
     * Check and resolve player collisions with saws
     * @param player The player to check collisions for
     */
    public checkPlayerSawCollisions(player: Player): void {
        // Get all particles from the player's verlet body
        const particles = player.verletBody.getParticles();
        
        // Check collision for each particle against each saw
        for (const particle of particles) {
            const particlePosition = particle.position;
            const particleRadius = particle.radius;
            
            // Check against all saws - treat them just like any other rigid body
            for (const saw of this.saws) {
                const translation = saw.body.shape.collideWithSphere(particlePosition, particleRadius);
                
                // If collision detected, resolve it normally
                if (translation) {
                    // Move the particle out of collision
                    particlePosition.add(translation);

                    // Calculate dynamic body velocity at the contact point
                    const bodyVelocity = new THREE.Vector3().copy(saw.body.velocity);
                    
                    // Add angular velocity contribution
                    const contactPoint = particlePosition.clone().sub(translation);
                    const relativePos = contactPoint.clone().sub(saw.body.shape.position);
                    const angularComponent = new THREE.Vector3().crossVectors(
                        saw.body.angularVelocity,
                        relativePos
                    );
                    bodyVelocity.add(angularComponent);
                    
                    const newVelocity = bodyVelocity.multiplyScalar(15);
                    
                    // Update the previous position to create this new velocity
                    particle.previousPosition.copy(particlePosition).sub(newVelocity);

                    // Spawn particles at the contact point
                    this.spawnSawCollisionParticles(
                        contactPoint,
                        bodyVelocity
                    );
                }
            }
        }
    }
    
    /**
     * Update the paths for saws that move in patterns
     */
    private updateSawPaths(): void {
        // Update each saw's physics body
        for (const saw of this.saws) {
            saw.update();
        }
    }

    // Add method to spawn particles when a saw collision occurs
    private spawnSawCollisionParticles(position: THREE.Vector3, sawVelocity: THREE.Vector3): void {
        this.particleSystem.spawnParticleBurst(
            30,  // Lots of particles
            {
                position: position.clone(),
                velocity: sawVelocity.clone().multiplyScalar(10), // High velocity
                radius: 0.3,
                color: 0x00ff55,
                lifetime: 3.0,
                gravity: true,
                elongationFactor: 0.2  // Much lower elongation (was 1.5) for less stretching at high speeds
            },
            4.0,  // Velocity randomization
            0.2,  // Radius variation
            1.0   // Lifetime variation
        );
    }
}


