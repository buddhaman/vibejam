import * as THREE from 'three';

/**
 * Instanced renderer for efficient drawing of beams and spheres
 * This allows rendering many objects with the same geometry using GPU instancing
 */
export class InstancedRenderer {
    private scene: THREE.Scene;
    
    // Instanced meshes
    private beamMesh: THREE.InstancedMesh;
    private sphereMesh: THREE.InstancedMesh;
    
    // Instance counts
    private maxBeams: number = 1000;
    private maxSpheres: number = 1000;
    private beamCount: number = 0;
    private sphereCount: number = 0;
    
    // Reusable objects to avoid garbage collection
    private tempMatrix: THREE.Matrix4 = new THREE.Matrix4();
    private tempQuaternion: THREE.Quaternion = new THREE.Quaternion();
    private tempPosition: THREE.Vector3 = new THREE.Vector3();
    private tempScale: THREE.Vector3 = new THREE.Vector3();
    private tempColor: THREE.Color = new THREE.Color();
    private upVector: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
    
    /**
     * Create a new instanced renderer
     * @param scene The Three.js scene to add the meshes to
     */
    constructor(scene: THREE.Scene) {
        this.scene = scene;
        
        // Create beam (box) geometry - a 1x1x1 box that will be scaled
        const beamGeometry = new THREE.BoxGeometry(1, 1, 1);
        const beamMaterial = new THREE.MeshToonMaterial();
        this.beamMesh = new THREE.InstancedMesh(beamGeometry, beamMaterial, this.maxBeams);
        this.beamMesh.count = 0; // Start with 0 instances
        this.beamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.beamMesh.castShadow = true;
        this.beamMesh.receiveShadow = true;
        this.scene.add(this.beamMesh);
        
        // Create sphere geometry - a sphere with radius 1 that will be scaled
        const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
        const sphereMaterial = new THREE.MeshToonMaterial();
        this.sphereMesh = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, this.maxSpheres);
        this.sphereMesh.count = 0; // Start with 0 instances
        this.sphereMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.sphereMesh.castShadow = true;
        this.sphereMesh.receiveShadow = true;
        this.scene.add(this.sphereMesh);
    }
    
    /**
     * Reset the instance counts - call this at the beginning of each frame
     */
    public reset(): void {
        this.beamCount = 0;
        this.sphereCount = 0;
        this.beamMesh.count = 0;
        this.sphereMesh.count = 0;
    }
    
    /**
     * Set the toon texture for the materials
     * @param texture The gradient map texture for toon shading
     */
    public setToonTexture(texture: THREE.Texture | null): void {
        if (this.beamMesh.material instanceof THREE.MeshToonMaterial) {
            this.beamMesh.material.gradientMap = texture || null;
            this.beamMesh.material.needsUpdate = true;
        }
        
        if (this.sphereMesh.material instanceof THREE.MeshToonMaterial) {
            this.sphereMesh.material.gradientMap = texture || null;
            this.sphereMesh.material.needsUpdate = true;
        }
    }
    
    /**
     * Render a beam between two points
     * @param from Start position
     * @param to End position
     * @param width Width of the beam
     * @param height Height of the beam
     * @param up Up vector for orienting the beam (default is Y-up)
     * @param color Color of the beam
     */
    public renderBeam(
        from: THREE.Vector3, 
        to: THREE.Vector3, 
        width: number = 0.2, 
        height: number = 0.2, 
        up: THREE.Vector3 = this.upVector,
        color: THREE.Color | number = 0xffffff
    ): void {
        // Check if we've reached the maximum number of beams
        if (this.beamCount >= this.maxBeams) {
            console.warn('Maximum number of beams reached');
            return;
        }
        
        // Calculate the midpoint between the two positions
        this.tempPosition.copy(from).add(to).multiplyScalar(0.5);
        
        // Calculate the direction vector and length
        const direction = to.clone().sub(from);
        const length = direction.length();
        direction.normalize();
        
        // Calculate the rotation from the default orientation to the desired orientation
        // Default box is oriented along Y-axis, so we need to rotate to align with direction
        this.tempQuaternion.setFromUnitVectors(this.upVector, direction);
        
        // Set the scale for the beam
        this.tempScale.set(width, length, height);
        
        // Compose the transformation matrix
        this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
        
        // Set the instance matrix
        this.beamMesh.setMatrixAt(this.beamCount, this.tempMatrix);
        
        // Set the color
        if (typeof color === 'number') {
            this.tempColor.set(color);
        } else {
            this.tempColor.copy(color);
        }
        this.beamMesh.setColorAt(this.beamCount, this.tempColor);
        
        // Increment the beam count
        this.beamCount++;
        this.beamMesh.count = this.beamCount;
        
        // Mark the instance matrices and colors as needing update
        this.beamMesh.instanceMatrix.needsUpdate = true;
        if (this.beamMesh.instanceColor) this.beamMesh.instanceColor.needsUpdate = true;
    }
    
    /**
     * Render a sphere at a position
     * @param center Center position of the sphere
     * @param radius Radius of the sphere
     * @param color Color of the sphere
     */
    public renderSphere(
        center: THREE.Vector3, 
        radius: number = 1.0, 
        color: THREE.Color | number = 0xffffff
    ): void {
        // Check if we've reached the maximum number of spheres
        if (this.sphereCount >= this.maxSpheres) {
            console.warn('Maximum number of spheres reached');
            return;
        }
        
        // Set the position
        this.tempPosition.copy(center);
        
        // Set the scale (uniform in all directions for a sphere)
        this.tempScale.set(radius, radius, radius);
        
        // No rotation needed for spheres (they're symmetrical)
        this.tempQuaternion.identity();
        
        // Compose the transformation matrix
        this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
        
        // Set the instance matrix
        this.sphereMesh.setMatrixAt(this.sphereCount, this.tempMatrix);
        
        // Set the color
        if (typeof color === 'number') {
            this.tempColor.set(color);
        } else {
            this.tempColor.copy(color);
        }
        this.sphereMesh.setColorAt(this.sphereCount, this.tempColor);
        
        // Increment the sphere count
        this.sphereCount++;
        this.sphereMesh.count = this.sphereCount;
        
        // Mark the instance matrices and colors as needing update
        this.sphereMesh.instanceMatrix.needsUpdate = true;
        if (this.sphereMesh.instanceColor) this.sphereMesh.instanceColor.needsUpdate = true;
    }
    
    /**
     * Update the meshes after all instances have been added
     * This must be called after rendering all beams and spheres for a frame
     */
    public update(): void {
        // Update the instance counts
        this.beamMesh.count = this.beamCount;
        this.sphereMesh.count = this.sphereCount;
        
        // Update the instance matrices and colors
        this.beamMesh.instanceMatrix.needsUpdate = true;
        this.sphereMesh.instanceMatrix.needsUpdate = true;
        
        if (this.beamMesh.instanceColor) this.beamMesh.instanceColor.needsUpdate = true;
        if (this.sphereMesh.instanceColor) this.sphereMesh.instanceColor.needsUpdate = true;
    }
}
