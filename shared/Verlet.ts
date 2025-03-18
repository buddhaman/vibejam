import * as THREE from 'three';

export class Verlet {
    public position: THREE.Vector3;
    public previousPosition: THREE.Vector3;

    constructor(position: THREE.Vector3) {
        this.position = position.clone();
        this.previousPosition = position.clone();
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
    private constraints: Array<{ a: Verlet; b: Verlet; restLength: number }>;
    private bounds: { min: THREE.Vector3; max: THREE.Vector3 };

    constructor() {
        this.particles = [];
        this.constraints = [];
        // Define world bounds (10x10x10 box)
        this.bounds = {
            min: new THREE.Vector3(-5, 0, -5),
            max: new THREE.Vector3(5, 10, 5)
        };
    }

    public addParticle(position: THREE.Vector3): Verlet {
        const particle = new Verlet(position);
        this.particles.push(particle);
        return particle;
    }

    public addConstraint(a: Verlet, b: Verlet): void {
        const restLength = a.position.distanceTo(b.position);
        this.constraints.push({ a, b, restLength });
    }

    public update(deltaTime: number): void {
        // Update particles
        this.particles.forEach(p => p.update(deltaTime));

        // Solve constraints
        this.solveConstraints();

        // Apply world bounds
        this.applyBounds();
    }

    private solveConstraints(): void {
        this.constraints.forEach(({ a, b, restLength }) => {
            const diff = a.position.clone().sub(b.position);
            const currentLength = diff.length();
            
            if (currentLength === 0) return;

            const correction = diff.multiplyScalar((currentLength - restLength) / currentLength);
            a.position.sub(correction.clone().multiplyScalar(0.5));
            b.position.add(correction.clone().multiplyScalar(0.5));
        });
    }

    private applyBounds(): void {
        this.particles.forEach(particle => {
            // Clamp position to bounds
            particle.position.x = Math.max(this.bounds.min.x, Math.min(this.bounds.max.x, particle.position.x));
            particle.position.y = Math.max(this.bounds.min.y, Math.min(this.bounds.max.y, particle.position.y));
            particle.position.z = Math.max(this.bounds.min.z, Math.min(this.bounds.max.z, particle.position.z));

            // If particle hits bounds, reflect velocity
            if (particle.position.x <= this.bounds.min.x || particle.position.x >= this.bounds.max.x) {
                particle.previousPosition.x = particle.position.x + (particle.position.x - particle.previousPosition.x);
            }
            if (particle.position.y <= this.bounds.min.y || particle.position.y >= this.bounds.max.y) {
                particle.previousPosition.y = particle.position.y + (particle.position.y - particle.previousPosition.y);
            }
            if (particle.position.z <= this.bounds.min.z || particle.position.z >= this.bounds.max.z) {
                particle.previousPosition.z = particle.position.z + (particle.position.z - particle.previousPosition.z);
            }
        });
    }

    public getParticles(): Verlet[] {
        return this.particles;
    }

    public getConstraints(): Array<{ a: Verlet; b: Verlet; restLength: number }> {
        return this.constraints;
    }
} 