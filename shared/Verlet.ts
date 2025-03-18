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

    public update(deltaTime: number): void {
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
    private groundFriction: number = 0.95; // Ground friction (0-1)
    private gravity: number = 0.15; // Increased gravity

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

    public update(deltaTime: number): void {
        // Apply gravity and air friction
        this.particles.forEach(particle => {
            // Apply gravity
            particle.applyImpulse(new THREE.Vector3(0, -this.gravity * deltaTime, 0));
            
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
                velocity.multiplyScalar(this.groundFriction);
                particle.previousPosition.copy(particle.position);
                particle.position.add(velocity);
            }
        });
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