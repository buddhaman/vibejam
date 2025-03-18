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

        // Create three particles in a triangular formation
        const particle1 = this.verletBody.addParticle(new THREE.Vector3(0, 1, 0));
        const particle2 = this.verletBody.addParticle(new THREE.Vector3(0.5, 1, 0));
        const particle3 = this.verletBody.addParticle(new THREE.Vector3(0.25, 1.433, 0));

        // Connect particles with springs
        this.verletBody.addConstraint(particle1, particle2);
        this.verletBody.addConstraint(particle2, particle3);
        this.verletBody.addConstraint(particle3, particle1);

        // Create visual meshes for particles
        const geometry = new THREE.SphereGeometry(0.1, 16, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: id === 'local' ? 0x00ff00 : 0xff0000 
        });

        // Create meshes for each particle
        this.verletBody.getParticles().forEach((particle, index) => {
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
        
        // Apply forces to all particles based on input
        particles.forEach(particle => {
            const impulse = new THREE.Vector3();
            
            if (input.w) impulse.z -= this.moveSpeed;
            if (input.s) impulse.z += this.moveSpeed;
            if (input.a) impulse.x -= this.moveSpeed;
            if (input.d) impulse.x += this.moveSpeed;
            
            particle.applyImpulse(impulse);
        });
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