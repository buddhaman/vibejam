import * as THREE from 'three';
import { VerletBody, Verlet } from '../../shared/Verlet';

export class Rope {
    private verletBody: VerletBody;
    private fixedPoint: THREE.Vector3;
    private segments: number;
    private segmentLength: number;
    private totalLength: number;
    
    // Store the first and last particles for easy access
    public startParticle!: Verlet;
    public endParticle!: Verlet;
    
    constructor(
        fixedPoint: THREE.Vector3,
        segments: number = 10,
        totalLength: number = 5,
        particleRadius: number = 0.1
    ) {
        this.verletBody = new VerletBody();
        this.fixedPoint = fixedPoint.clone();
        this.segments = segments;
        this.totalLength = totalLength;
        this.segmentLength = totalLength / segments;
        
        // Create rope particles
        let prevParticle: Verlet | null = null;
        for (let i = 0; i <= segments; i++) {
            // Calculate position along the rope
            const position = new THREE.Vector3(
                fixedPoint.x,
                fixedPoint.y - (i * this.segmentLength),
                fixedPoint.z
            );
            
            const particle = this.verletBody.addParticle(position, particleRadius);
            
            // Store first and last particles
            if (i === 0) this.startParticle = particle;
            if (i === segments) this.endParticle = particle;
            
            // Add constraint between consecutive particles
            if (prevParticle) {
                this.verletBody.addConstraint(prevParticle, particle);
            }
            
            prevParticle = particle;
        }
        
        // Adjust physics properties for rope-like behavior
        this.verletBody.airFriction = 0.99;  // Less air friction
        this.verletBody.gravity = 0.02;      // Reduced gravity
        this.verletBody.groundFriction = 0.8; // More ground friction
    }
    
    public update(): void {
        // Fix the start particle to the fixed point
        this.startParticle.position.copy(this.fixedPoint);
        this.startParticle.previousPosition.copy(this.fixedPoint);
        
        // Update physics
        this.verletBody.update();
        
        // Handle internal collisions between rope segments
        this.verletBody.handleInternalCollisions();
    }
    
    public setFixedPoint(point: THREE.Vector3): void {
        this.fixedPoint.copy(point);
    }
    
    public getEndPosition(): THREE.Vector3 {
        return this.endParticle.position.clone();
    }
    
    public getParticlePositions(): THREE.Vector3[] {
        return this.verletBody.getParticles().map(p => p.position.clone());
    }
    
    public applyForceToEnd(force: THREE.Vector3): void {
        if (this.endParticle) {
            this.endParticle.applyImpulse(force);
        }
    }
    
    public setEndPosition(position: THREE.Vector3): void {
        this.endParticle.position.copy(position);
        this.endParticle.previousPosition.copy(position);
    }
    
    public getSegments(): number {
        return this.segments;
    }
    
    public getTotalLength(): number {
        return this.totalLength;
    }
    
    public getVerletBody(): VerletBody {
        return this.verletBody;
    }
    
    // Helper method to render the rope using the instanced renderer
    public render(instancedRenderer: any, color: number = 0xffffff): void {
        const particles = this.verletBody.getParticles();
        
        // Render particles and connections
        for (let i = 0; i < particles.length - 1; i++) {
            const start = particles[i].position;
            const end = particles[i + 1].position;
            
            // Render the connection between particles
            instancedRenderer.renderBeam(
                start,
                end,
                particles[i].radius,
                particles[i + 1].radius,
                undefined,
                color
            );
            
            // Optionally render particles at the joints
            instancedRenderer.renderSphere(
                start,
                particles[i].radius,
                color
            );
        }
        
        // Render the last particle
        instancedRenderer.renderSphere(
            particles[particles.length - 1].position,
            particles[particles.length - 1].radius,
            color
        );
    }
}
