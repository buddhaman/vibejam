import * as THREE from 'three';

/**
 * Camera modes for different game contexts
 */
export enum CameraMode {
    THIRD_PERSON, // Standard gameplay following a target 
    FIRST_PERSON_FLYING, // Free-flying camera for editor
}

export class Camera {
    // The actual Three.js camera object
    public threeCamera: THREE.PerspectiveCamera;
    
    // Camera positioning parameters
    public distance: number = 8;           // Distance from target
    public theta: number = -Math.PI;       // Horizontal angle (around Y axis)
    public phi: number = Math.PI / 3;      // Vertical angle (0 to PI, where PI/2 is horizontal)
    public target: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
    
    // Current camera mode
    public mode: CameraMode = CameraMode.THIRD_PERSON;
    
    // For first-person flying mode
    private velocity: THREE.Vector3 = new THREE.Vector3();
    private flyingDirection: THREE.Vector3 = new THREE.Vector3();
    private movementSpeed: number = 0.2; // Increased for better control
    
    // Track input states for flying mode
    private moveForward: boolean = false;
    private moveBackward: boolean = false;
    private moveLeft: boolean = false;
    private moveRight: boolean = false;
    private moveUp: boolean = false;
    private moveDown: boolean = false;
    
    // Camera sensitivity for mouse movement
    public sensitivity: number = 0.003;
    
    // For first-person orientation
    private euler: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ'); // YXZ order is important for proper camera controls

    /**
     * Creates a new camera with specified mode
     */
    constructor(mode: CameraMode = CameraMode.THIRD_PERSON) {
        // Create Three.js camera with default settings
        this.threeCamera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        
        // Set initial mode
        this.setMode(mode);
    }
    
    /**
     * Change camera mode
     */
    public setMode(mode: CameraMode): void {
        const previousMode = this.mode;
        this.mode = mode;
        
        if (mode === CameraMode.FIRST_PERSON_FLYING) {
            // When switching to flying mode, preserve the current view direction
            if (previousMode === CameraMode.THIRD_PERSON) {
                // Convert from third-person orbital coordinates to first-person Euler angles
                this.euler.y = this.theta; // Horizontal rotation
                this.euler.x = this.phi - Math.PI/2; // Vertical rotation (adjusted for coordinate system)
                
                // Apply the Euler angles to the camera
                this.threeCamera.quaternion.setFromEuler(this.euler);
            }
            
            // Reset velocity
            this.velocity.set(0, 0, 0);
        } else if (mode === CameraMode.THIRD_PERSON && previousMode === CameraMode.FIRST_PERSON_FLYING) {
            // When switching from flying mode to third-person, 
            // preserve the viewing direction as orbital angles
            this.euler.setFromQuaternion(this.threeCamera.quaternion, 'YXZ');
            this.theta = this.euler.y;
            this.phi = this.euler.x + Math.PI/2;
            
            // Ensure phi is in valid range
            this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi));
        }
        
        console.log(`Camera mode set to: ${CameraMode[mode]}`);
    }
    
    /**
     * Get current camera mode
     */
    public getMode(): CameraMode {
        return this.mode;
    }
    
    /**
     * Update camera position based on current mode
     */
    public update(targetPosition?: THREE.Vector3): void {
        if (this.mode === CameraMode.THIRD_PERSON) {
            this.updateThirdPerson(targetPosition);
        } else if (this.mode === CameraMode.FIRST_PERSON_FLYING) {
            this.updateFirstPersonFlying();
        }
    }
    
    /**
     * Update camera in third-person mode (following a target)
     */
    private updateThirdPerson(targetPosition?: THREE.Vector3): void {
        // Update target if provided (e.g., player position)
        if (targetPosition) {
            // Smooth lerp to the target position
            this.target.lerp(targetPosition, 0.1);
        }
        
        // Calculate camera position using spherical coordinates
        const x = this.distance * Math.sin(this.phi) * Math.cos(this.theta);
        const y = this.distance * Math.cos(this.phi);
        const z = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
        
        // Position camera relative to target
        this.threeCamera.position.set(
            this.target.x + x,
            this.target.y + y,
            this.target.z + z
        );
        
        // Look at the target
        this.threeCamera.lookAt(this.target);
    }
    
    /**
     * Update camera in first-person flying mode (free movement)
     */
    private updateFirstPersonFlying(): void {
        // Calculate movement based on current input state
        this.flyingDirection.set(0, 0, 0);
        
        // Add movement based on keys being pressed
        if (this.moveForward) this.flyingDirection.z -= 1;
        if (this.moveBackward) this.flyingDirection.z += 1;
        if (this.moveLeft) this.flyingDirection.x -= 1;
        if (this.moveRight) this.flyingDirection.x += 1;
        if (this.moveUp) this.flyingDirection.y += 1;
        if (this.moveDown) this.flyingDirection.y -= 1;
        
        // Only apply movement if we're actually trying to move
        if (this.flyingDirection.lengthSq() > 0) {
            // Normalize to prevent faster diagonal movement
            this.flyingDirection.normalize();
            
            // Transform direction vector to match camera orientation (for x/z movement)
            const horizontalDirection = new THREE.Vector3(
                this.flyingDirection.x, 
                0, 
                this.flyingDirection.z
            );
            
            if (horizontalDirection.lengthSq() > 0) {
                horizontalDirection.normalize();
                horizontalDirection.applyQuaternion(this.threeCamera.quaternion);
                
                // Apply horizontal movement
                this.velocity.x += horizontalDirection.x * this.movementSpeed;
                this.velocity.z += horizontalDirection.z * this.movementSpeed;
            }
            
            // Apply vertical movement (world Y axis)
            this.velocity.y += this.flyingDirection.y * this.movementSpeed;
        }
        
        // Apply velocity to position
        this.threeCamera.position.add(this.velocity);
        
        // Apply drag to slow down naturally
        this.velocity.multiplyScalar(0.85);
        
        // Update target to be in front of the camera for consistent behavior
        const lookDirection = new THREE.Vector3(0, 0, -1);
        lookDirection.applyQuaternion(this.threeCamera.quaternion);
        this.target.copy(this.threeCamera.position).add(lookDirection.multiplyScalar(10));
    }
    
    /**
     * Rotate the camera (both modes)
     */
    public rotate(deltaX: number, deltaY: number): void {
        if (this.mode === CameraMode.THIRD_PERSON) {
            // For third-person, update the orbital angles
            this.theta += deltaX * this.sensitivity;
            
            // Keep phi within bounds (avoid flipping)
            this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, 
                this.phi + deltaY * this.sensitivity));
        } else {
            // For first-person, use Euler angles for more stable rotation
            // Get current rotation from camera
            this.euler.setFromQuaternion(this.threeCamera.quaternion, 'YXZ');
            
            // Update rotation angles
            this.euler.y -= deltaX * this.sensitivity; // Horizontal rotation
            this.euler.x -= deltaY * this.sensitivity; // Vertical rotation
            
            // Clamp vertical rotation to avoid flipping
            this.euler.x = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.euler.x));
            
            // Apply rotation to camera
            this.threeCamera.quaternion.setFromEuler(this.euler);
        }
    }
    
    /**
     * Update movement input state (for first-person flying mode)
     */
    public updateMovementState(
        forward: boolean, 
        backward: boolean, 
        left: boolean, 
        right: boolean,
        up: boolean = false, 
        down: boolean = false
    ): void {
        this.moveForward = forward;
        this.moveBackward = backward;
        this.moveLeft = left;
        this.moveRight = right;
        this.moveUp = up;
        this.moveDown = down;
    }
    
    /**
     * Handle window resize
     */
    public handleResize(width: number, height: number): void {
        this.threeCamera.aspect = width / height;
        this.threeCamera.updateProjectionMatrix();
    }
    
    /**
     * Get camera position (useful for placing objects in front of camera)
     */
    public getPosition(): THREE.Vector3 {
        return this.threeCamera.position.clone();
    }
    
    /**
     * Get forward direction vector
     */
    public getForwardVector(): THREE.Vector3 {
        if (this.mode === CameraMode.FIRST_PERSON_FLYING) {
            // For first-person, use camera's local -Z axis
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(this.threeCamera.quaternion);
            return forward;
        } else {
            // For third-person, calculate forward vector from phi and theta
            const forward = new THREE.Vector3(
                -Math.sin(this.phi) * Math.cos(this.theta),
                0, // No vertical component for player movement
                -Math.sin(this.phi) * Math.sin(this.theta)
            );
            forward.normalize();
            return forward;
        }
    }
    
    /**
     * Set camera zoom (adjust distance in third-person, FOV in first-person)
     */
    public zoom(delta: number): void {
        if (this.mode === CameraMode.THIRD_PERSON) {
            // For third-person, adjust distance
            this.distance = Math.max(2, Math.min(20, this.distance + delta * 0.01));
        } else {
            // For first-person, adjust FOV
            this.threeCamera.fov = Math.max(30, Math.min(90, this.threeCamera.fov + delta * 0.05));
            this.threeCamera.updateProjectionMatrix();
        }
    }
    
    /**
     * Move forward in the direction the camera is facing
     * Useful for placing objects in front of the camera
     */
    public moveForwardDistance(distance: number): THREE.Vector3 {
        const forward = this.getForwardVector();
        forward.multiplyScalar(distance);
        
        // Return position in front of camera
        return this.threeCamera.position.clone().add(forward);
    }
    
    /**
     * Set camera position directly (useful for teleporting)
     */
    public setPosition(position: THREE.Vector3): void {
        this.threeCamera.position.copy(position);
    }
}


