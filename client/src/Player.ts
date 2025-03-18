import * as THREE from 'three';
import { Verlet, VerletBody } from '../../shared/Verlet';

export class Player {
    public id: string;
    public verletBody: VerletBody;
    public meshes: THREE.Mesh[];
    public lines: {
        mesh: THREE.Mesh;
        particleA: Verlet;  // Replace with your particle type
        particleB: Verlet;  // Replace with your particle type
    }[];
    public moveSpeed: number = 0.08;
    private isMoving: boolean = false;
    public forward: THREE.Vector3 = new THREE.Vector3(0, 0, 1); // Default forward vector

    constructor(id: string) {
        this.id = id;
        this.verletBody = new VerletBody();
        this.meshes = [];
        this.lines = [];

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

        // Create visual meshes for particles
        const particleMaterial = new THREE.MeshStandardMaterial({ 
            color: id === 'local' ? 0x77dd77 : 0x6495ed,  // Soft green for local, pastel blue for others
            roughness: 0.3,
            metalness: 0.3,
            emissive: 0x221133,
            emissiveIntensity: 0.1
        });

        // Create meshes for each particle
        this.verletBody.getParticles().forEach((particle, index) => {
            const geometry = new THREE.SphereGeometry(particle.radius, 16, 16);
            const mesh = new THREE.Mesh(geometry, particleMaterial);
            mesh.position.copy(particle.position);
            this.meshes.push(mesh);
        });

        // Create cylinders to visualize constraints
        const constraintMaterial = new THREE.MeshStandardMaterial({ 
            color: id === 'local' ? 0x99eebb : 0x88aaff,  // Lighter version of player color
            roughness: 0.5,
            metalness: 0.2,
            transparent: true,
            opacity: 0.9
        });
        
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
    }

    // Helper method to position and orient a cylinder between two points
    private positionCylinder(cylinder: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
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

    public handleInput(input: { w: boolean; a: boolean; s: boolean; d: boolean }): void {
        this.isMoving = input.w || input.a || input.s || input.d;
        
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

        // Find most forward and backward particles based on the forward vector
        let mostForwardParticle = particles[0];
        let mostBackwardParticle = particles[0];

        particles.forEach(particle => {
            const forwardDistance = particle.position.dot(this.forward);
            if (forwardDistance > mostForwardParticle.position.dot(this.forward)) {
                mostForwardParticle = particle;
            }
            if (forwardDistance < mostBackwardParticle.position.dot(this.forward)) {
                mostBackwardParticle = particle;
            }
        });

        // Calculate the perpendicular vector for left/right movement
        const upVector = new THREE.Vector3(0, 1, 0);
        const rightVector = new THREE.Vector3().crossVectors(this.forward, upVector).normalize().negate();

        // Find most left and right particles based on the right vector
        let mostLeftParticle = particles[0];
        let mostRightParticle = particles[0];

        particles.forEach(particle => {
            const rightDistance = particle.position.dot(rightVector);
            if (rightDistance > mostRightParticle.position.dot(rightVector)) {
                mostRightParticle = particle;
            }
            if (rightDistance < mostLeftParticle.position.dot(rightVector)) {
                mostLeftParticle = particle;
            }
        });

        // Apply forces to highest/lowest and forward/backward particles
        if (input.w) {
            const forwardImpulse = this.forward.clone().multiplyScalar(this.moveSpeed);
            highestParticle.applyImpulse(forwardImpulse.clone().negate());
            lowestParticle.applyImpulse(forwardImpulse);
            mostForwardParticle.applyImpulse(new THREE.Vector3(0, this.moveSpeed, 0));
            mostBackwardParticle.applyImpulse(new THREE.Vector3(0, -this.moveSpeed, 0));
        }
        if (input.s) {
            const backwardImpulse = this.forward.clone().multiplyScalar(-this.moveSpeed);
            highestParticle.applyImpulse(backwardImpulse.clone().negate());
            lowestParticle.applyImpulse(backwardImpulse);
            mostForwardParticle.applyImpulse(new THREE.Vector3(0, -this.moveSpeed, 0));
            mostBackwardParticle.applyImpulse(new THREE.Vector3(0, this.moveSpeed, 0));
        }
        if (input.a) {
            const leftImpulse = rightVector.clone().multiplyScalar(-this.moveSpeed);
            highestParticle.applyImpulse(leftImpulse);
            lowestParticle.applyImpulse(leftImpulse.clone().negate());
            mostLeftParticle.applyImpulse(new THREE.Vector3(0, -this.moveSpeed, 0));
            mostRightParticle.applyImpulse(new THREE.Vector3(0, this.moveSpeed, 0));
        }
        if (input.d) {
            const rightImpulse = rightVector.clone().multiplyScalar(this.moveSpeed);
            highestParticle.applyImpulse(rightImpulse);
            lowestParticle.applyImpulse(rightImpulse.clone().negate());
            mostRightParticle.applyImpulse(new THREE.Vector3(0, -this.moveSpeed, 0));
            mostLeftParticle.applyImpulse(new THREE.Vector3(0, this.moveSpeed, 0));
        }
    }

    public update(): void {
        // Update physics
        this.verletBody.update();

        // Apply standing force to head only when not moving
        const particles = this.verletBody.getParticles();
        const head = particles[0];
        
        let standingForce : number = 0.1;
        if (!this.isMoving) {
            standingForce = 0.45;
        }
        head.applyImpulse(new THREE.Vector3(0, standingForce, 0));

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
            this.meshes[index].position.copy(particle.position);
        });

        // Update cylinder positions and orientations
        this.lines.forEach(({ mesh, particleA, particleB }) => {
            this.positionCylinder(mesh, particleA.position, particleB.position);
            
            // Update cylinder length
            const distance = particleA.position.distanceTo(particleB.position);
            mesh.scale.y = distance;
        });
    }

    public getMeshes(): THREE.Object3D[] {
        return this.meshes;
    }
} 