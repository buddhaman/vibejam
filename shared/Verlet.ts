import * as THREE from 'three';

export class Verlet {
    public position: THREE.Vector3;
    private previousPosition: THREE.Vector3;

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

    constructor() {
        this.particles = [];
        this.constraints = [];
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

    public getParticles(): Verlet[] {
        return this.particles;
    }

    public getConstraints(): Array<{ a: Verlet; b: Verlet; restLength: number }> {
        return this.constraints;
    }
} 