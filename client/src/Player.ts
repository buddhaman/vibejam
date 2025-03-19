import * as THREE from 'three';
import { Verlet, VerletBody } from '../../shared/Verlet';

export class Player {
    public id: string;
    public verletBody: VerletBody;
    public meshes: THREE.Object3D[];
    public lines: {
        mesh: THREE.Mesh;
        particleA: Verlet;  // Replace with your particle type
        particleB: Verlet;  // Replace with your particle type
    }[];
    public moveSpeed: number = 0.08;
    public isMoving: boolean = false;
    public forward: THREE.Vector3 = new THREE.Vector3(0, 0, 1); // Default forward vector
    public lastMovementDir: THREE.Vector3 = new THREE.Vector3(0, 0, 1); // Default last movement direction
    public leftEye: THREE.Mesh;
    public rightEye: THREE.Mesh;
    public leftPupil: THREE.Mesh;
    public rightPupil: THREE.Mesh;
    public eyeBaseOffset: THREE.Vector3 = new THREE.Vector3(0.2, 0.2, 0.5); // Increased z-offset to place eyes on surface of head
    public debugMode: boolean = false;
    public forwardArrow: THREE.ArrowHelper;
    public directionArrow: THREE.ArrowHelper;

    constructor(id: string, toonTexture?: THREE.Texture, enableDebug: boolean = false) {
        this.id = id;
        this.verletBody = new VerletBody();
        this.meshes = [];
        this.lines = [];
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

        // Create visual meshes for particles with toon material
        const particleMaterial = new THREE.MeshToonMaterial({ 
            color: id === 'local' ? 0x77dd77 : 0x6495ed,  // Soft green for local, pastel blue for others
        });
        
        // Only set gradient map if texture is provided
        if (toonTexture) {
            particleMaterial.gradientMap = toonTexture;
        }

        // Create meshes for each particle
        this.verletBody.getParticles().forEach((particle, index) => {
            const geometry = new THREE.SphereGeometry(particle.radius, 16, 16);
            const mesh = new THREE.Mesh(geometry, particleMaterial);
            mesh.position.copy(particle.position);
            this.meshes.push(mesh);
        });

        // For the cylinder constraints with toon material
        const constraintMaterial = new THREE.MeshToonMaterial({ 
            color: id === 'local' ? 0x99eebb : 0x88aaff,
        });
        
        // Only set gradient map if texture is provided
        if (toonTexture) {
            constraintMaterial.gradientMap = toonTexture;
        }
        
        this.verletBody.getConstraints().forEach(({ a, b }) => {
            // Calculate distance and direction
            const start = a.position;
            const end = b.position;
            
            // Create cylinder geometry
            // The cylinder's height is along the Y-axis by default
            const radius = 0.2;
            const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, 1.0, 8);
            const cylinder = new THREE.Mesh(cylinderGeometry, constraintMaterial);
            
            // Position and orient the cylinder
            this.positionCylinder(cylinder, start, end);
            
            this.meshes.push(cylinder);
            
            // Store references for updates
            this.lines.push({
                mesh: cylinder,
                particleA: a,
                particleB: b
            });
        });

        // Create eyes
        const eyeRadius = 0.3;
        const pupilRadius = 0.1;

        // Left eye
        const leftEyeGeometry = new THREE.SphereGeometry(eyeRadius, 8, 8);
        const leftEyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.leftEye = new THREE.Mesh(leftEyeGeometry, leftEyeMaterial);
        // Initial position - set to zero to avoid initial offset
        this.leftEye.position.set(0, 0, 0);
        this.meshes.push(this.leftEye);

        // Left pupil
        const leftPupilGeometry = new THREE.SphereGeometry(pupilRadius, 8, 8);
        const leftPupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.leftPupil = new THREE.Mesh(leftPupilGeometry, leftPupilMaterial);
        // Initial position - set to zero to avoid initial offset
        this.leftPupil.position.set(0, 0, 0);
        this.meshes.push(this.leftPupil);

        // Right eye
        const rightEyeGeometry = new THREE.SphereGeometry(eyeRadius, 8, 8);
        const rightEyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.rightEye = new THREE.Mesh(rightEyeGeometry, rightEyeMaterial);
        // Initial position - set to zero to avoid initial offset
        this.rightEye.position.set(0, 0, 0);
        this.meshes.push(this.rightEye);

        // Right pupil
        const rightPupilGeometry = new THREE.SphereGeometry(pupilRadius, 8, 8);
        const rightPupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.rightPupil = new THREE.Mesh(rightPupilGeometry, rightPupilMaterial);
        // Initial position - set to zero to avoid initial offset
        this.rightPupil.position.set(0, 0, 0);
        this.meshes.push(this.rightPupil);

        // Create debug arrows
        const arrowLength = 3.0;
        const arrowHeadLength = 0.5;
        const arrowHeadWidth = 0.3;
        this.forwardArrow = new THREE.ArrowHelper(
            this.forward.clone(),
            new THREE.Vector3(0, 0, 0),
            arrowLength,
            0xff0000, // Red color for forward
            arrowHeadLength,
            arrowHeadWidth
        );
        this.forwardArrow.visible = this.debugMode;
        
        this.directionArrow = new THREE.ArrowHelper(
            this.lastMovementDir.clone(),
            new THREE.Vector3(0, 0, 0),
            arrowLength,
            0x00ff00, // Green color for movement direction
            arrowHeadLength,
            arrowHeadWidth
        );
        this.directionArrow.visible = this.debugMode;
        
        // Add arrows to meshes array
        this.meshes.push(this.forwardArrow);
        this.meshes.push(this.directionArrow);
    }

    // Helper method to position and orient a cylinder between two points
    public positionCylinder(cylinder: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
        // Position at midpoint
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        cylinder.position.copy(midpoint);
        
        // Orient cylinder
        // 1. Create a direction vector from start to end
        const direction = new THREE.Vector3().subVectors(end, start);
        
        // 2. Create a quaternion rotation from the Y axis to this direction
        // The default cylinder orientation is along the Y axis
        const quaternion = new THREE.Quaternion();
        // Get the axis perpendicular to Y and our direction
        const yAxis = new THREE.Vector3(0, 1, 0);
        const rotationAxis = new THREE.Vector3().crossVectors(yAxis, direction).normalize();
        
        // If direction is parallel to Y, we need a different approach
        if (rotationAxis.length() === 0) {
            // Check if pointing up or down
            if (direction.y < 0) {
                // Pointing down, rotate 180 degrees around X
                quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
            }
            // If pointing up, no rotation needed
        } else {
            // Calculate angle between Y and direction
            const angle = Math.acos(yAxis.dot(direction.clone().normalize()));
            quaternion.setFromAxisAngle(rotationAxis, angle);
        }
        
        cylinder.quaternion.copy(quaternion);
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

        // Update particle meshes
        this.verletBody.getParticles().forEach((particle, index) => {
            // Cast to Mesh to ensure we can access position
            if (this.meshes[index] instanceof THREE.Mesh) {
                (this.meshes[index] as THREE.Mesh).position.copy(particle.position);
            }
        });

        // Update cylinder positions and orientations
        this.lines.forEach(({ mesh, particleA, particleB }) => {
            this.positionCylinder(mesh, particleA.position, particleB.position);
            
            // Update cylinder length
            const distance = particleA.position.distanceTo(particleB.position);
            mesh.scale.y = distance;
        });

        // Calculate the eye positions using the local head orientation
        // Create a local coordinate system for the head
        const headRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this.lastMovementDir).normalize();
        if (headRight.length() < 0.1) {
            // If lastMovementDir is parallel to up, use a default right vector
            headRight.set(1, 0, 0);
        }
        
        const headUp = new THREE.Vector3(0, 1, 0);
        const headForward = this.lastMovementDir.clone();
        
        // Calculate offset in local space then convert to world space
        // Get head radius (first particle is the head)
        const headRadius = particles[0].radius;

        // Left eye - position on surface of head
        const leftEyeOffset = new THREE.Vector3()
            .addScaledVector(headRight, -this.eyeBaseOffset.x)
            .addScaledVector(headUp, this.eyeBaseOffset.y)
            .addScaledVector(headForward, this.eyeBaseOffset.z);
        leftEyeOffset.normalize().multiplyScalar(headRadius); // Normalize and scale to head radius
            
        // Right eye - position on surface of head
        const rightEyeOffset = new THREE.Vector3()
            .addScaledVector(headRight, this.eyeBaseOffset.x)
            .addScaledVector(headUp, this.eyeBaseOffset.y)
            .addScaledVector(headForward, this.eyeBaseOffset.z);
        rightEyeOffset.normalize().multiplyScalar(headRadius); // Normalize and scale to head radius
        
        // Apply calculated offsets
        this.leftEye.position.copy(headParticle.position).add(leftEyeOffset);
        this.rightEye.position.copy(headParticle.position).add(rightEyeOffset);
        
        // Calculate pupil positions on the eye surfaces
        const eyeRadius = (this.leftEye.geometry as THREE.SphereGeometry).parameters.radius;
        
        // Calculate direction from head to each eye
        const leftEyeDir = this.leftEye.position.clone().sub(headParticle.position).normalize();
        const rightEyeDir = this.rightEye.position.clone().sub(headParticle.position).normalize();
        
        // Position pupils on the forward-most part of each eye
        this.leftPupil.position.copy(this.leftEye.position).add(
            leftEyeDir.clone().multiplyScalar(eyeRadius * 0.9)
        );
        
        this.rightPupil.position.copy(this.rightEye.position).add(
            rightEyeDir.clone().multiplyScalar(eyeRadius * 0.9)
        );
        
        // Update debug arrows if debug mode is enabled
        if (this.debugMode) {
            // Position arrows at head
            this.forwardArrow.position.copy(headParticle.position);
            this.directionArrow.position.copy(headParticle.position);
            
            // Set arrow directions
            this.forwardArrow.setDirection(this.forward.clone().normalize());
            this.directionArrow.setDirection(this.lastMovementDir.clone().normalize());
        }
    }

    public getMeshes(): THREE.Object3D[] {
        return this.meshes;
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
        this.forwardArrow.visible = this.debugMode;
        this.directionArrow.visible = this.debugMode;
    }

    public updateToonTexture(toonTexture?: THREE.Texture): void {
        // Update materials on existing meshes
        this.meshes.forEach(mesh => {
            if (mesh instanceof THREE.Mesh && 
                mesh.material instanceof THREE.MeshToonMaterial) {
                mesh.material.gradientMap = toonTexture || null;
                
                // Enable shadows
                mesh.material.needsUpdate = true;
                mesh.castShadow = toonTexture !== undefined;
                mesh.receiveShadow = toonTexture !== undefined;
            }
        });
    }
} 