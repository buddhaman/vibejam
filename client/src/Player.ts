import * as THREE from 'three';
import { Verlet, VerletBody } from '../../shared/Verlet';
import { InstancedRenderer } from './Render';
import { Rope } from './Rope';

export enum MovementState {
    OnGround,
    InAir,
    OnRope,
}

export class Player {
    public id: string;
    public verletBody: VerletBody;
    public moveSpeed: number = 0.14;
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
    // Current rope the player is holding
    public rope: Rope | null = null;
    public notOnGroundTimer: number = 0;
    public movementState: MovementState = MovementState.OnGround;

    // New properties to store input state
    private inputDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    private isJumping: boolean = false;
    private isSqueezing: boolean = false;

    constructor(id: string, enableDebug: boolean = false) {
        this.id = id;
        this.verletBody = new VerletBody();
        this.debugMode = enableDebug;

        const scale = 1.0;
        const baseRadius = scale * 0.4;
        const headRadius = scale * 0.6;

        // Create particles for the simplified figure
        // Head - raise initial position to compensate for physics settling
        const head = this.verletBody.addParticle(new THREE.Vector3(0, 4.7 * scale, 0), headRadius);
        
        // Neck - raise initial position
        const neck = this.verletBody.addParticle(new THREE.Vector3(0, 4.2 * scale, 0), baseRadius);
        
        // Waist - raise initial position
        const waist = this.verletBody.addParticle(new THREE.Vector3(0, 2.2 * scale, 0), baseRadius);
        
        // Left leg - raise initial position
        const leftKnee = this.verletBody.addParticle(new THREE.Vector3(0, 1.2 * scale, 0), baseRadius);
        const leftFoot = this.verletBody.addParticle(new THREE.Vector3(0, 0.2, 0), baseRadius);
        
        // Right leg - raise initial position
        const rightKnee = this.verletBody.addParticle(new THREE.Vector3(0, 1.2 * scale, 0), baseRadius);
        const rightFoot = this.verletBody.addParticle(new THREE.Vector3(0, 0.2, 0), baseRadius);
        
        // Left arm - raise initial position
        const leftElbow = this.verletBody.addParticle(new THREE.Vector3(0, 3.2 * scale, 0), baseRadius);
        const leftHand = this.verletBody.addParticle(new THREE.Vector3(0, 2.2 * scale, 0), baseRadius);
        
        // Right arm - raise initial position
        const rightElbow = this.verletBody.addParticle(new THREE.Vector3(0, 3.2 * scale, 0), baseRadius);
        const rightHand = this.verletBody.addParticle(new THREE.Vector3(0, 2.2 * scale, 0), baseRadius);

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

        // Initialize the physics immediately after constructing
        this.initPhysics();
    }

    /**
     * Initialize physics state for the player
     * This ensures the player starts in a proper position
     */
    private initPhysics(): void {
        // Apply initial standing force to reach equilibrium
        const particles = this.verletBody.getParticles();
        const headParticle = particles[0];
        
        // Apply a strong initial lift to position the character correctly
        headParticle.applyImpulse(new THREE.Vector3(0, 0.6, 0));
        
        // Run several physics steps to achieve equilibrium
        for (let i = 0; i < 10; i++) {
            this.verletBody.update();
            this.verletBody.handleInternalCollisions();
        }
    }

    /**
     * Handle user input by storing the input state only - no physics here
     */
    public handleInput(input: { w: boolean; a: boolean; s: boolean; d: boolean; space: boolean; shift?: boolean }): void {
        // Set movement flags based on input
        this.isMoving = input.w || input.a || input.s || input.d;
        this.isJumping = input.space || false;
        this.isSqueezing = input.shift || false;
        
        // Calculate the perpendicular vector for left/right movement
        const upVector = new THREE.Vector3(0, 1, 0);
        const rightVector = new THREE.Vector3().crossVectors(this.forward, upVector).normalize();

        // Set movement direction based on input - store it, don't apply forces yet
        this.inputDirection.set(0, 0, 0);
        if (input.w) this.inputDirection.add(this.forward);
        if (input.s) this.inputDirection.sub(this.forward);
        if (input.a) this.inputDirection.sub(rightVector);
        if (input.d) this.inputDirection.add(rightVector);
        
        // Normalize if there's movement
        if (this.inputDirection.lengthSq() > 0) {
            this.inputDirection.normalize();
            // Update last movement direction for rendering
            this.lastMovementDir.copy(this.inputDirection);
        }
    }

    public hitPlatform(normal: THREE.Vector3): void {
        if(normal.y > 0){
            this.notOnGroundTimer = 0;
            this.movementState = MovementState.OnGround;
        }
    }

    public fixedUpdate(): void {
        const particles = this.verletBody.getParticles();

        this.notOnGroundTimer++;
        if(this.movementState != MovementState.OnRope && this.notOnGroundTimer > 10){
            this.movementState = MovementState.InAir;
        }
        
        // Find relevant particles for applying forces
        let highestParticle = particles[0];
        let lowestParticle = particles[0];
        let leftHand = particles[8];  // Changed from 7 to 8 (left hand)
        let rightHand = particles[10]; // Changed from 9 to 10 (right hand)
        
        particles.forEach(particle => {
            if (particle.position.y > highestParticle.position.y) {
                highestParticle = particle;
            }
            if (particle.position.y < lowestParticle.position.y) {
                lowestParticle = particle;
            }
        });
        
        const headParticle = particles[0];
        
        // Handle rope interaction
        if (this.rope) {
            this.movementState = MovementState.OnRope;
            const ropeEndPos = this.rope.getEndPosition();
            const handMidpoint = new THREE.Vector3().addVectors(leftHand.position, rightHand.position).multiplyScalar(0.5);
            
            // If shift is pressed, release the rope
            if (this.isSqueezing) {
                this.rope = null;
                this.movementState = MovementState.InAir;
            } else {
                // Calculate the force needed to move hands to rope
                const toRope = new THREE.Vector3().subVectors(ropeEndPos, handMidpoint);
                const distance = toRope.length();
                
                // Apply spring-like force to hands
                const springStrength = 0.15;
                const handForce = toRope.normalize().multiplyScalar(distance * springStrength);
                
                // Apply force to hands
                leftHand.applyImpulse(handForce);
                rightHand.applyImpulse(handForce);
                
                // Apply opposite force to rope end
                const ropeForce = handForce.clone().multiplyScalar(-0.5);
                this.rope.applyForceToEnd(ropeForce);
                
                // Add player's movement influence to rope
                if (this.isMoving && this.inputDirection.lengthSq() > 0) {
                    const moveForce = this.inputDirection.clone().multiplyScalar(this.moveSpeed * 0.8);
                    this.rope.applyForceToEnd(moveForce);
                }
                
                // Add gravity influence from player to rope
                const playerMass = 0.3;
                const gravityForce = new THREE.Vector3(0, -0.1 * playerMass, 0);
                this.rope.applyForceToEnd(gravityForce);
                
                // Final position correction to ensure hands align with rope
                // This ensures visual connection while maintaining physical simulation
                const finalHandPos = this.rope.getEndPosition();
                const handOffset = new THREE.Vector3(0.2, 0, 0); // Slight offset between hands
                
                leftHand.position.copy(finalHandPos).sub(handOffset);
                rightHand.position.copy(finalHandPos).add(handOffset);
                leftHand.previousPosition.copy(leftHand.position);
                rightHand.previousPosition.copy(rightHand.position);
            }
        }
        
        // Movement forces - now applied in fixedUpdate based on stored inputDirection
        if (this.isMoving && this.inputDirection.lengthSq() > 0) {
            // Find most forward and backward particles in the movement direction
            let mostForwardParticle = particles[0];
            let mostBackwardParticle = particles[0];
            
            particles.forEach(particle => {
                const dirDistance = particle.position.dot(this.inputDirection);
                if (dirDistance > mostForwardParticle.position.dot(this.inputDirection)) {
                    mostForwardParticle = particle;
                }
                if (dirDistance < mostBackwardParticle.position.dot(this.inputDirection)) {
                    mostBackwardParticle = particle;
                }
            });
            
            // Apply movement forces
            const moveImpulse = this.inputDirection.clone().multiplyScalar(this.moveSpeed);
            lowestParticle.applyImpulse(moveImpulse.clone().negate());
            highestParticle.applyImpulse(moveImpulse.clone());
            
            // Vertical forces to create rotation
            mostForwardParticle.applyImpulse(new THREE.Vector3(0, -this.moveSpeed, 0));
            mostBackwardParticle.applyImpulse(new THREE.Vector3(0, this.moveSpeed, 0));
        }
        
        // Jumping/stretching - apply in fixedUpdate based on isJumping flag
        if (this.isJumping) {
            const stretchForce = 0.8;
            highestParticle.applyImpulse(new THREE.Vector3(0, stretchForce, 0));
            lowestParticle.applyImpulse(new THREE.Vector3(0, -stretchForce, 0));
        }
        
        // Squeezing - apply in fixedUpdate based on isSqueezing flag
        if (this.isSqueezing) {
            const squeezeForce = 0.2;
            highestParticle.applyImpulse(new THREE.Vector3(0, -squeezeForce, 0));
            lowestParticle.applyImpulse(new THREE.Vector3(0, squeezeForce, 0));
        }
        
        // Standing force - always applied in fixedUpdate
        let standingForce: number = 0.2;
        switch(this.movementState){
            case MovementState.OnGround:
                standingForce = this.isMoving ? 0.2 : 0.3;
                break;
            case MovementState.OnRope:
                standingForce = 0.0;
                break;
            case MovementState.InAir:
                standingForce = 0.0;
                break;
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
        
        // Update physics - call this after all forces have been applied
        this.verletBody.update();

        // Handle internal collisions
        this.verletBody.handleInternalCollisions();

        // Update blinking animation
        this.updateBlinking();

        // Update the friction based on the movement state
        switch(this.movementState){
            case MovementState.OnGround:
                this.verletBody.airFriction = 0.99;
                break;
            case MovementState.OnRope:
                this.verletBody.airFriction = 0.99;
                break;
            case MovementState.InAir:
                this.verletBody.airFriction = 0.97;
                
                // Apply aerial movement - only when in air
                if (this.isMoving && this.inputDirection.lengthSq() > 0) {
                    // Apply a gentler force to all particles when in air
                    const airMoveStrength = this.moveSpeed * 0.2;
                    const airMoveImpulse = this.inputDirection.clone().multiplyScalar(airMoveStrength);
                    
                    // Apply to all particles for consistent aerial movement
                    particles.forEach(particle => {
                        particle.applyImpulse(airMoveImpulse.clone());
                    });
                }
                break;
        }
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
     * Set the position of the player by translating all particles
     * @param translation The vector to translate by
     */
    public setPosition(translation: THREE.Vector3): void {
        const particles = this.verletBody.getParticles();
        // Find average position of all particles
        const avgPosition = new THREE.Vector3();
        particles.forEach(particle => {
            avgPosition.add(particle.position);
        });
        avgPosition.divideScalar(particles.length);
        
        // Apply translation to all particles
        particles.forEach(particle => {
            particle.position.sub(avgPosition);
            particle.position.add(translation);
            particle.previousPosition.sub(avgPosition);
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