import * as THREE from 'three';
import { Verlet, VerletBody } from '../../shared/Verlet';
import { InstancedRenderer } from './Render';

export class Player {
    public id: string;
    public verletBody: VerletBody;
    public moveSpeed: number = 0.08;
    public isMoving: boolean = false;
    public forward: THREE.Vector3 = new THREE.Vector3(0, 0, 1); // Default forward vector
    public lastMovementDir: THREE.Vector3 = new THREE.Vector3(0, 0, 1); // Default last movement direction
    public eyeBaseOffset: THREE.Vector3 = new THREE.Vector3(0.2, 0.2, 0.5); // Increased z-offset to place eyes on surface of head
    public debugMode: boolean = false;
    private blinkTimer: number = 0;
    private blinkDuration: number = 0;
    private nextBlinkTime: number = Math.random() * 60 + 20; // 20-80 frames
    private isBlinking: boolean = false;
    private rendererInitialized: boolean = false;

    constructor(id: string, toonTexture?: THREE.Texture, enableDebug: boolean = false) {
        this.id = id;
        this.verletBody = new VerletBody();
        this.debugMode = enableDebug;

        const scale = 1.0;
        const baseRadius = scale * 0.4;
        const headRadius = scale * 0.6;

        // Create particles for the simplified figure
        // Head
        const head = this.verletBody.addParticle(new THREE.Vector3(0, 4.5 * scale, 0), headRadius);
        
        // Neck
        const neck = this.verletBody.addParticle(new THREE.Vector3(0, 4.0 * scale, 0), baseRadius);
        
        // Waist
        const waist = this.verletBody.addParticle(new THREE.Vector3(0, 2.0 * scale, 0), baseRadius);
        
        // Left leg
        const leftKnee = this.verletBody.addParticle(new THREE.Vector3(0, 1.0 * scale, 0), baseRadius);
        const leftFoot = this.verletBody.addParticle(new THREE.Vector3(0, 0, 0), baseRadius);
        
        // Right leg
        const rightKnee = this.verletBody.addParticle(new THREE.Vector3(0, 1.0 * scale, 0), baseRadius);
        const rightFoot = this.verletBody.addParticle(new THREE.Vector3(0, 0, 0), baseRadius);
        
        // Left arm
        const leftElbow = this.verletBody.addParticle(new THREE.Vector3(0, 3.0 * scale, 0), baseRadius);
        const leftHand = this.verletBody.addParticle(new THREE.Vector3(0, 2.0 * scale, 0), baseRadius);
        
        // Right arm
        const rightElbow = this.verletBody.addParticle(new THREE.Vector3(0, 3.0 * scale, 0), baseRadius);
        const rightHand = this.verletBody.addParticle(new THREE.Vector3(0, 2.0 * scale, 0), baseRadius);

        // Connect the particles with constraints
        // Head and neck
        this.verletBody.addConstraint(head, neck);
        
        // Neck and waist
        this.verletBody.addConstraint(neck, waist);
        
        // Legs
        this.verletBody.addConstraint(waist, leftKnee);
        this.verletBody.addConstraint(leftKnee, leftFoot);
        this.verletBody.addConstraint(waist, rightKnee);
        this.verletBody.addConstraint(rightKnee, rightFoot);
        
        // Arms
        this.verletBody.addConstraint(neck, leftElbow);
        this.verletBody.addConstraint(leftElbow, leftHand);
        this.verletBody.addConstraint(neck, rightElbow);
        this.verletBody.addConstraint(rightElbow, rightHand);

        // No need for creating traditional meshes since we'll use instanced rendering
    }

    public handleInput(input: { w: boolean; a: boolean; s: boolean; d: boolean; space: boolean; shift?: boolean }): void {
        this.isMoving = input.w || input.a || input.s || input.d || input.space || !!input.shift;

        // Calculate the perpendicular vector for left/right movement
        const upVector = new THREE.Vector3(0, 1, 0);
        const rightVector = new THREE.Vector3().crossVectors(this.forward, upVector).normalize();

        // Create a single movement direction vector based on input
        const movementDir = new THREE.Vector3(0, 0, 0);
        if (input.w) movementDir.add(this.forward);
        if (input.s) movementDir.sub(this.forward);
        if (input.a) movementDir.sub(rightVector);
        if (input.d) movementDir.add(rightVector);
        
        // Only normalize if there's movement
        if (movementDir.lengthSq() > 0) {
            movementDir.normalize();
            // Update last movement direction
            this.lastMovementDir.copy(movementDir);
        }

        const particles = this.verletBody.getParticles();
        
        // Find highest and lowest particles based on the up vector
        let highestParticle = particles[0];
        let lowestParticle = particles[0];
        
        particles.forEach(particle => {
            if (particle.position.y > highestParticle.position.y) {
                highestParticle = particle;
            }
            if (particle.position.y < lowestParticle.position.y) {
                lowestParticle = particle;
            }
        });

        // Find most forward and backward particles in the movement direction
        let mostForwardParticle = particles[0];
        let mostBackwardParticle = particles[0];
        
        if (movementDir.lengthSq() > 0) {
            particles.forEach(particle => {
                const dirDistance = particle.position.dot(movementDir);
                if (dirDistance > mostForwardParticle.position.dot(movementDir)) {
                    mostForwardParticle = particle;
                }
                if (dirDistance < mostBackwardParticle.position.dot(movementDir)) {
                    mostBackwardParticle = particle;
                }
            });
            
            // Apply movement forces
            // Force to lowest particle in movement direction
            const moveImpulse = movementDir.clone().multiplyScalar(this.moveSpeed);
            lowestParticle.applyImpulse(moveImpulse.clone().negate());
            
            // Reverse force to highest particle
            highestParticle.applyImpulse(moveImpulse.clone());
            
            // Vertical forces to create rotation
            mostForwardParticle.applyImpulse(new THREE.Vector3(0, -this.moveSpeed, 0));
            mostBackwardParticle.applyImpulse(new THREE.Vector3(0, this.moveSpeed, 0));
        }
        
        // Handle spacebar action - apply equal and opposite forces
        if (input.space) {
            // Apply equal and opposite forces (net force = 0)
            const stretchForce = 0.8; // Adjust this value for desired stretch amount
            highestParticle.applyImpulse(new THREE.Vector3(0, stretchForce, 0));
            lowestParticle.applyImpulse(new THREE.Vector3(0, -stretchForce, 0));
        }
        
        // Handle shift action - squeeze (opposite of stretch)
        if (input.shift) {
            const squeezeForce = 0.2;
            highestParticle.applyImpulse(new THREE.Vector3(0, -squeezeForce, 0));
            lowestParticle.applyImpulse(new THREE.Vector3(0, squeezeForce, 0));
        }
    }

    public fixedUpdate(): void {
        // Update physics
        this.verletBody.update();

        // Apply standing force to head only when not moving
        const particles = this.verletBody.getParticles();
        const headParticle = particles[0];
        
        let standingForce: number = 0.30;
        if (!this.isMoving) {
            standingForce = 0.45;
        }
        headParticle.applyImpulse(new THREE.Vector3(0, standingForce, 0));

        // Apply repulsive forces between particles
        particles.forEach((particle1, i) => {
            particles.forEach((particle2, j) => {
                if (i !== j) {
                    const diff = particle2.position.clone().sub(particle1.position);
                    const distance = diff.length();
                    if (distance < 1.0) {
                        // Linear force with softer values
                        const force = diff.normalize().multiplyScalar(0.002 * (1.0 - distance));
                        particle1.applyImpulse(force.clone().multiplyScalar(-1));
                        particle2.applyImpulse(force);
                    }
                }
            });
        });

        // Handle internal collisions
        this.verletBody.handleInternalCollisions();

        // Update blinking animation with deltaTime
        this.updateBlinking();
    }

    /**
     * Get the player's position (based on head particle)
     * @returns The player's current position as a Vector3
     */
    public getPosition(): THREE.Vector3 {
        const particles = this.verletBody.getParticles();
        if (particles.length > 0) {
            // Calculate average position of all particles
            const avgPosition = new THREE.Vector3();
            particles.forEach(particle => {
                avgPosition.add(particle.position);
            });
            avgPosition.divideScalar(particles.length);
            return avgPosition;
        }
        return new THREE.Vector3(0, 0, 0);
    }

    /**
     * Move the player by adding a translation vector to all particles
     * @param translation The vector to translate by
     */
    public move(translation: THREE.Vector3): void {
        const particles = this.verletBody.getParticles();
        
        // Apply translation to all particles
        particles.forEach(particle => {
            particle.position.add(translation);
            particle.previousPosition.add(translation);
        });
    }

    public setDebugMode(debugMode: boolean): void {
        this.debugMode = debugMode;
    }

    /**
     * Handles eye blinking and updates the blink timer
     * @param deltaTime Time since last frame in ms
     */
    private updateBlinking(): void {
        this.blinkTimer++;
        // If blinking, check if we should stop
        if (this.isBlinking) {
            if (this.blinkTimer >= this.blinkDuration) {
                // End blink
                this.isBlinking = false;
                
                // Reset for next blink
                this.blinkTimer = 0;
                this.nextBlinkTime = Math.random() * 60 + 20; // 20-80 frames
            }
        } 
        // Not blinking, check if it's time to blink
        else if (this.blinkTimer >= this.nextBlinkTime) {
            // Start blinking
            this.isBlinking = true;
            
            // Set blink duration 3 to 5 frames
            this.blinkDuration = 3 + Math.random() * 5; 
            this.blinkTimer = 0;
        }
    }

    /**
     * Render the player using the instanced renderer
     * This draws spheres for particles and beams for connections
     * @param renderer The instanced renderer to use
     */
    public render(renderer: InstancedRenderer): void {
        if (!this.rendererInitialized) {
            // First-time initialization if needed
            this.rendererInitialized = true;
        }
        
        const particles = this.verletBody.getParticles();
        const constraints = this.verletBody.getConstraints();
        const headParticle = particles[0]; // First particle is the head
        
        // Use different colors for local vs remote players
        const particleColor = this.id === 'local' ? 0x77dd77 : 0x6495ed;  // Green for local, blue for others
        const constraintColor = this.id === 'local' ? 0x99eebb : 0x88aaff;
        
        // Draw particles as spheres
        particles.forEach(particle => {
            renderer.renderSphere(
                particle.position,
                particle.radius,
                particleColor
            );
        });
        
        // Draw constraints as beams
        constraints.forEach(constraint => {
            // Get the start and end positions of the constraint
            const startPos = constraint.a.position;
            const endPos = constraint.b.position;
            
            // Calculate beam thickness (can be adjusted)
            const beamWidth = 0.3;
            
            // Render a beam between the two particles
            renderer.renderBeam(
                startPos,
                endPos,
                beamWidth,
                beamWidth,
                undefined, // Use default up vector
                constraintColor
            );
        });
        
        // Draw eyes using instanced rendering - now using lastMovementDir instead of forward
        if (!this.isBlinking) {
            // Define constants for eye rendering
            const headRadius = headParticle.radius;
            const eyeRadius = 0.3;
            const pupilRadius = 0.05;
            const upVector = new THREE.Vector3(0, 1, 0);
            
            // Use lastMovementDir instead of forward for eye orientation
            const movementDirNormalized = this.lastMovementDir.clone().normalize();
            const rightVector = new THREE.Vector3().crossVectors(upVector, movementDirNormalized).normalize();
            
            // Eye placement parameters
            const eyeVerticalOffset = 0.1;  // Slightly above center
            const eyeHorizontalOffset = 0.45; // Left/right offset
            const eyeForwardOffset = 0.9;   // Toward front of head
            
            // Calculate positions for left and right eyes on the head surface
            const leftEyeBasePos = new THREE.Vector3()
                .addScaledVector(rightVector, -eyeHorizontalOffset)
                .addScaledVector(upVector, eyeVerticalOffset)
                .addScaledVector(movementDirNormalized, eyeForwardOffset);
            
            leftEyeBasePos.normalize().multiplyScalar(headRadius);
            
            const rightEyeBasePos = new THREE.Vector3()
                .addScaledVector(rightVector, eyeHorizontalOffset)
                .addScaledVector(upVector, eyeVerticalOffset)
                .addScaledVector(movementDirNormalized, eyeForwardOffset);
            
            rightEyeBasePos.normalize().multiplyScalar(headRadius);
            
            // Final eye positions (relative to head center)
            const leftEyePos = headParticle.position.clone().add(leftEyeBasePos);
            const rightEyePos = headParticle.position.clone().add(rightEyeBasePos);
            
            // Render eyes (white spheres)
            renderer.renderSphere(leftEyePos, eyeRadius, 0xffffff);
            renderer.renderSphere(rightEyePos, eyeRadius, 0xffffff);
            
            // Calculate pupil positions (slightly in front of eyes)
            const pupilOffset = eyeRadius; // How far the pupil sits in front of eye center
            const leftPupilPos = leftEyePos.clone().add(movementDirNormalized.clone().multiplyScalar(pupilOffset));
            const rightPupilPos = rightEyePos.clone().add(movementDirNormalized.clone().multiplyScalar(pupilOffset));
            
            // Render pupils (black spheres)
            renderer.renderSphere(leftPupilPos, pupilRadius, 0x000000);
            renderer.renderSphere(rightPupilPos, pupilRadius, 0x000000);
        }
        
        // Draw debug arrows if in debug mode
        if (this.debugMode) {
            const headPos = headParticle.position;
            
            // Forward direction arrow (red)
            const forwardEnd = new THREE.Vector3().copy(headPos).add(
                this.forward.clone().normalize().multiplyScalar(3.0)
            );
            renderer.renderBeam(
                headPos,
                forwardEnd,
                0.1,
                0.1,
                undefined,
                0xff0000
            );
            
            // Movement direction arrow (green)
            const movementEnd = new THREE.Vector3().copy(headPos).add(
                this.lastMovementDir.clone().normalize().multiplyScalar(3.0)
            );
            renderer.renderBeam(
                headPos,
                movementEnd,
                0.1,
                0.1,
                undefined,
                0x00ff00
            );
        }
    }
} 