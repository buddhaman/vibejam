import * as THREE from 'three';
import { VerletBody } from '../../shared/Verlet';

export class Player {
    private id: string;
    private verletBody: VerletBody;
    private meshes: THREE.Mesh[];
    private lines: THREE.Line[];
    private moveSpeed: number = 0.1;

    constructor(id: string) {
        this.id = id;
        this.verletBody = new VerletBody();
        this.meshes = [];
        this.lines = [];

        // Create particles for the humanoid figure
        // Head
        const head = this.verletBody.addParticle(new THREE.Vector3(0, 2, 0), 0.15);
        
        // Neck
        const neck = this.verletBody.addParticle(new THREE.Vector3(0, 1.8, 0), 0.1);
        
        // Torso
        const torso = this.verletBody.addParticle(new THREE.Vector3(0, 1.4, 0), 0.12);
        
        // Left arm
        const leftShoulder = this.verletBody.addParticle(new THREE.Vector3(-0.3, 1.6, 0), 0.1);
        const leftElbow = this.verletBody.addParticle(new THREE.Vector3(-0.5, 1.4, 0), 0.08);
        const leftHand = this.verletBody.addParticle(new THREE.Vector3(-0.7, 1.2, 0), 0.08);
        
        // Right arm
        const rightShoulder = this.verletBody.addParticle(new THREE.Vector3(0.3, 1.6, 0), 0.1);
        const rightElbow = this.verletBody.addParticle(new THREE.Vector3(0.5, 1.4, 0), 0.08);
        const rightHand = this.verletBody.addParticle(new THREE.Vector3(0.7, 1.2, 0), 0.08);
        
        // Left leg
        const leftHip = this.verletBody.addParticle(new THREE.Vector3(-0.2, 1.2, 0), 0.1);
        const leftKnee = this.verletBody.addParticle(new THREE.Vector3(-0.3, 0.8, 0), 0.08);
        const leftFoot = this.verletBody.addParticle(new THREE.Vector3(-0.4, 0.4, 0), 0.08);
        
        // Right leg
        const rightHip = this.verletBody.addParticle(new THREE.Vector3(0.2, 1.2, 0), 0.1);
        const rightKnee = this.verletBody.addParticle(new THREE.Vector3(0.3, 0.8, 0), 0.08);
        const rightFoot = this.verletBody.addParticle(new THREE.Vector3(0.4, 0.4, 0), 0.08);

        // Connect the particles with constraints
        // Head and neck
        this.verletBody.addConstraint(head, neck);
        
        // Neck and torso
        this.verletBody.addConstraint(neck, torso);
        
        // Arms
        this.verletBody.addConstraint(neck, leftShoulder);
        this.verletBody.addConstraint(neck, rightShoulder);
        this.verletBody.addConstraint(leftShoulder, leftElbow);
        this.verletBody.addConstraint(leftElbow, leftHand);
        this.verletBody.addConstraint(rightShoulder, rightElbow);
        this.verletBody.addConstraint(rightElbow, rightHand);
        
        // Legs
        this.verletBody.addConstraint(torso, leftHip);
        this.verletBody.addConstraint(torso, rightHip);
        this.verletBody.addConstraint(leftHip, leftKnee);
        this.verletBody.addConstraint(leftKnee, leftFoot);
        this.verletBody.addConstraint(rightHip, rightKnee);
        this.verletBody.addConstraint(rightKnee, rightFoot);

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
        const particles = this.verletBody.getParticles();
        
        // Find highest and lowest particles based on current positions
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
        
        // Apply forces to highest and lowest particles in opposite directions
        if (input.w) {
            highestParticle.applyImpulse(new THREE.Vector3(0, 0, -this.moveSpeed));
            lowestParticle.applyImpulse(new THREE.Vector3(0, 0, this.moveSpeed));
        }
        if (input.s) {
            highestParticle.applyImpulse(new THREE.Vector3(0, 0, this.moveSpeed));
            lowestParticle.applyImpulse(new THREE.Vector3(0, 0, -this.moveSpeed));
        }
        if (input.a) {
            highestParticle.applyImpulse(new THREE.Vector3(-this.moveSpeed, 0, 0));
            lowestParticle.applyImpulse(new THREE.Vector3(this.moveSpeed, 0, 0));
        }
        if (input.d) {
            highestParticle.applyImpulse(new THREE.Vector3(this.moveSpeed, 0, 0));
            lowestParticle.applyImpulse(new THREE.Vector3(-this.moveSpeed, 0, 0));
        }
    }

    public update(deltaTime: number): void {
        // Update physics
        this.verletBody.update(deltaTime);

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