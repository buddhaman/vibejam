import * as THREE from 'three';

export class Verlet {
    public position: THREE.Vector3;
    public previousPosition: THREE.Vector3;
    public radius: number;

    constructor(position: THREE.Vector3, radius: number = 0.1) {
        this.position = position.clone();
        this.previousPosition = position.clone();
        this.radius = radius;
    }

    public update(): void {
        const temp = this.position.clone();
        this.position.multiplyScalar(2).sub(this.previousPosition);
        this.previousPosition.copy(temp);
    }

    public applyImpulse(impulse: THREE.Vector3): void {
        this.previousPosition.sub(impulse);
    }
}

export class VerletBody {
    private particles: Verlet[];
    private constraints: { a: Verlet; b: Verlet; restLength: number }[];
    private bounds: { min: THREE.Vector3; max: THREE.Vector3 };
    private airFriction: number = 0.98; // Air resistance (0-1)
    private groundFriction: number = 0.6; // Ground friction (0-1)
    private gravity: number = 0.05; // Increased gravity

    constructor() {
        this.particles = [];
        this.constraints = [];
        this.bounds = {
            min: new THREE.Vector3(-5, -5, -5),
            max: new THREE.Vector3(5, 5, 5)
        };
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
            // Apply gravity
            particle.applyImpulse(new THREE.Vector3(0, -this.gravity, 0));
            
            // Apply air friction
            const velocity = particle.position.clone().sub(particle.previousPosition);
            velocity.multiplyScalar(this.airFriction);
            particle.previousPosition.copy(particle.position);
            particle.position.add(velocity);
        });

        // Solve constraints
        for (let i = 0; i < 5; i++) {
            this.solveConstraints();
        }

        // Apply bounds and ground friction
        this.particles.forEach(particle => {
            // Apply bounds
            particle.position.x = Math.max(this.bounds.min.x + particle.radius, Math.min(this.bounds.max.x - particle.radius, particle.position.x));
            particle.position.y = Math.max(this.bounds.min.y + particle.radius, Math.min(this.bounds.max.y - particle.radius, particle.position.y));
            particle.position.z = Math.max(this.bounds.min.z + particle.radius, Math.min(this.bounds.max.z - particle.radius, particle.position.z));

            // Apply ground friction when particle is near the ground
            if (particle.position.y - particle.radius < 0.0) {
                particle.position.y = particle.radius;
                const velocity = particle.position.clone().sub(particle.previousPosition);

                // Project velocity onto the xz-plane
                const velocityXZ = new THREE.Vector3(velocity.x, 0, velocity.z);
                velocityXZ.multiplyScalar(this.groundFriction);

                // Update previous position with the projected velocity
                particle.previousPosition.copy(particle.position);
                particle.position.add(velocityXZ);
            }
        });
    }

    public handleInternalCollisions(): void {
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const particle1 = this.particles[i];
                const particle2 = this.particles[j];
                
                const diff = particle2.position.clone().sub(particle1.position);
                const distance = diff.length();
                const minDistance = particle1.radius + particle2.radius;

                if (distance < minDistance) {
                    // Calculate collision response
                    const overlap = minDistance - distance;
                    const direction = diff.normalize();
                    const moveAmount = overlap * 0.5;

                    // Move particles apart
                    particle1.position.sub(direction.clone().multiplyScalar(moveAmount));
                    particle2.position.add(direction.clone().multiplyScalar(moveAmount));

                    // Reflect velocities
                    const relativeVelocity = particle2.position.clone()
                        .sub(particle2.previousPosition)
                        .sub(particle1.position.clone().sub(particle1.previousPosition));
                    
                    const velocityAlongNormal = relativeVelocity.dot(direction);
                    if (velocityAlongNormal < 0) continue;

                    const restitution = 0.5; // Bounciness factor
                    const impulse = direction.multiplyScalar(velocityAlongNormal * restitution);
                    
                    particle1.previousPosition.sub(impulse.clone().multiplyScalar(0.5));
                    particle2.previousPosition.add(impulse.clone().multiplyScalar(0.5));
                }
            }
        }
    }

    private solveConstraints(): void {
        this.constraints.forEach(({ a, b, restLength }) => {
            const currentLength = a.position.distanceTo(b.position);
            const correction = (currentLength - restLength) / currentLength;
            
            const correctionVector = b.position.clone().sub(a.position).multiplyScalar(correction * 0.5);
            a.position.add(correctionVector);
            b.position.sub(correctionVector);
        });
    }

    public getParticles(): Verlet[] {
        return this.particles;
    }

    public getConstraints(): { a: Verlet; b: Verlet; restLength: number }[] {
        return this.constraints;
    }
} 