import * as THREE from 'three';
import {Body} from './Body';
export class Verlet {
    public position: THREE.Vector3;
    public previousPosition: THREE.Vector3;
    public radius: number;
    private tempVector: THREE.Vector3; // Reusable vector

    constructor(position: THREE.Vector3, radius: number = 0.1) {
        this.position = position.clone(); // One-time allocation
        this.previousPosition = position.clone(); // One-time allocation
        this.tempVector = new THREE.Vector3(); // One-time allocation
        this.radius = radius;
    }

    public update(): void {
        this.tempVector.copy(this.position);
        this.position.multiplyScalar(2).sub(this.previousPosition);
        this.previousPosition.copy(this.tempVector);
    }

    public applyImpulse(impulse: THREE.Vector3): void {
        this.previousPosition.sub(impulse);
    }
}

export class VerletBody extends Body {
    public particles: Verlet[];
    public constraints: { a: Verlet; b: Verlet; restLength: number }[];
    public airFriction: number = 0.98; // Air resistance (0-1)
    public groundFriction: number = 0.6; // Ground friction (0-1)
    public gravity: number = 0.04; // Increased gravity
    private tempVec1: THREE.Vector3;
    private tempVec2: THREE.Vector3;
    private tempVec3: THREE.Vector3;
    private gravityVec: THREE.Vector3;

    constructor() {
        super();
        this.particles = [];
        this.constraints = [];
        this.tempVec1 = new THREE.Vector3();
        this.tempVec2 = new THREE.Vector3();
        this.tempVec3 = new THREE.Vector3();
        this.gravityVec = new THREE.Vector3(0, -this.gravity, 0);
    }

    public addParticle(position: THREE.Vector3, radius: number = 0.1): Verlet {
        const particle = new Verlet(position, radius);
        this.particles.push(particle);
        return particle;
    }

    public addConstraint(a: Verlet, b: Verlet): void {
        const restLength = a.position.distanceTo(b.position);
        this.constraints.push({ a, b, restLength });
    }

    public update(): void {
        // Apply gravity and air friction
        this.particles.forEach(particle => {
            particle.applyImpulse(this.gravityVec);
            
            // Apply air friction using tempVec1
            this.tempVec1.copy(particle.position).sub(particle.previousPosition);
            this.tempVec1.multiplyScalar(this.airFriction);
            particle.previousPosition.copy(particle.position);
            particle.position.add(this.tempVec1);
        });

        // Solve constraints
        for (let i = 0; i < 2; i++) {
            this.solveConstraints();
        }

        this.updateBoundingBox();

        // // Apply bounds and ground friction
        // this.particles.forEach(particle => {
        //     if (particle.position.y - particle.radius < 0.0) {
        //         particle.position.y = particle.radius;
                
        //         // Use tempVec1 for velocity calculation
        //         this.tempVec1.copy(particle.position).sub(particle.previousPosition);
        //         this.tempVec2.set(this.tempVec1.x, 0, this.tempVec1.z)
        //             .multiplyScalar(this.groundFriction);

        //         particle.previousPosition.copy(particle.position);
        //         particle.position.add(this.tempVec2);
        //     }
        // });
    }

    public updateBoundingBox(): void {
        // Get the min and max of the particles
        let min = new THREE.Vector3();
        let max = new THREE.Vector3();
        this.particles.forEach(particle => {
            min.min(particle.position);
            max.max(particle.position);
        });
        this.boundingBox.set(min, max);
    }

    public handleInternalCollisions(): void {
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const particle1 = this.particles[i];
                const particle2 = this.particles[j];
                
                this.tempVec1.copy(particle2.position).sub(particle1.position);
                const distance = this.tempVec1.length();
                const minDistance = particle1.radius + particle2.radius;

                if (distance < minDistance) {
                    const overlap = minDistance - distance;
                    this.tempVec1.normalize();
                    const moveAmount = overlap * 0.5;

                    this.tempVec2.copy(this.tempVec1).multiplyScalar(moveAmount);
                    particle1.position.sub(this.tempVec2);
                    particle2.position.add(this.tempVec2);

                    // Reflect velocities
                    this.tempVec2.copy(particle2.position).sub(particle2.previousPosition);
                    this.tempVec3.copy(particle1.position).sub(particle1.previousPosition);
                    this.tempVec2.sub(this.tempVec3);
                    
                    const velocityAlongNormal = this.tempVec2.dot(this.tempVec1);
                    if (velocityAlongNormal < 0) continue;

                    const restitution = 0.5;
                    this.tempVec1.multiplyScalar(velocityAlongNormal * restitution * 0.5);
                    
                    particle1.previousPosition.sub(this.tempVec1);
                    particle2.previousPosition.add(this.tempVec1);
                }
            }
        }
    }

    public solveConstraints(): void {
        this.constraints.forEach(({ a, b, restLength }) => {
            this.tempVec1.copy(b.position).sub(a.position);
            const currentLength = this.tempVec1.length();
            const correction = (currentLength - restLength) / currentLength;
            
            this.tempVec1.multiplyScalar(correction * 0.5);
            a.position.add(this.tempVec1);
            b.position.sub(this.tempVec1);
        });
    }

    public getParticles(): Verlet[] {
        return this.particles;
    }

    public getConstraints(): { a: Verlet; b: Verlet; restLength: number }[] {
        return this.constraints;
    }
} 