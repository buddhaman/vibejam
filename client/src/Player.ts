import * as THREE from 'three';
import { VerletBody } from '../../shared/Verlet';

export class Player {
    public id: string;
    public verletBody: VerletBody;
    public meshes: THREE.Mesh[];
    public lines: THREE.Line[];
    public moveSpeed: number = 0.1;
    private isMoving: boolean = false;
    public forward: THREE.Vector3 = new THREE.Vector3(0, 0, 1); // Default forward vector

    constructor(id: string) {
        this.id = id;
        this.verletBody = new VerletBody();
        this.meshes = [];
        this.lines = [];

        const scale = 1.0;
        const baseRadius = scale * 0.3;
        const headRadius = scale * baseRadius * 1.5;

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
        const material = new THREE.MeshStandardMaterial({ 
            color: id === 'local' ? 0x00ff00 : 0xff0000 
        });

        // Create meshes for each particle
        this.verletBody.getParticles().forEach((particle, index) => {
            const geometry = new THREE.SphereGeometry(particle.radius, 16, 16);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(particle.position);
            this.meshes.push(mesh);
        });

        // Create lines to visualize springs
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        this.verletBody.getConstraints().forEach(({ a, b }) => {
            const points = [
                a.position.clone(),
                b.position.clone()
            ];
            const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                lineMaterial
            );
            this.lines.push(line);
        });
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
            standingForce = 0.35;
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

        // Update spring lines
        this.verletBody.getConstraints().forEach(({ a, b }, index) => {
            const points = [
                a.position.clone(),
                b.position.clone()
            ];
            this.lines[index].geometry.setFromPoints(points);
        });
    }

    public getMeshes(): THREE.Object3D[] {
        return [...this.meshes, ...this.lines];
    }
} 