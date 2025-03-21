import * as THREE from 'three';
import nipplejs from 'nipplejs';

/**
 * Class that handles all mobile-specific controls including:
 * - Virtual joystick for movement using nipplejs
 * - Touch-based camera controls
 * - Virtual buttons for jump and crouch
 */
export class MobileControls {
    // DOM Elements
    private container: HTMLElement;
    private jumpButton: HTMLElement;
    private crouchButton: HTMLElement;
    
    // Nipplejs joystick
    private joystick: nipplejs.JoystickManager | null = null;
    
    // Camera control state
    private cameraTouchId: number | null = null;
    private previousCameraPos: { x: number, y: number } = { x: 0, y: 0 };
    
    // Button states
    private jumpActive: boolean = false;
    private crouchActive: boolean = false;
    
    // Movement direction - normalized vector represented as x,z components (y is up)
    public movementDirection: THREE.Vector2 = new THREE.Vector2(0, 0);
    
    // Callbacks
    private cameraRotateCallback: ((deltaX: number, deltaY: number) => void) | null = null;
    
    constructor() {
        // Create container for all mobile UI elements
        this.container = document.createElement('div');
        this.container.className = 'mobile-controls';
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none'; // Allow click-through by default
        this.container.style.userSelect = 'none';
        this.container.style.touchAction = 'none'; // Prevent default touch actions
        this.container.style.zIndex = '1000'; // Ensure controls are above everything
        
        // Create joystick zone
        const joystickZone = document.createElement('div');
        joystickZone.className = 'joystick-zone';
        joystickZone.style.position = 'absolute';
        joystickZone.style.bottom = '80px';
        joystickZone.style.left = '80px';
        joystickZone.style.width = '150px';
        joystickZone.style.height = '150px';
        joystickZone.style.pointerEvents = 'auto';
        joystickZone.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'; // More visible background
        joystickZone.style.borderRadius = '50%';
        joystickZone.style.border = '2px solid rgba(255, 255, 255, 0.5)'; // Add border for visibility
        this.container.appendChild(joystickZone);
        
        // Create jump button
        this.jumpButton = document.createElement('div');
        this.jumpButton.className = 'jump-button';
        this.jumpButton.style.position = 'absolute';
        this.jumpButton.style.bottom = '100px';
        this.jumpButton.style.right = '180px';
        this.jumpButton.style.width = '80px';
        this.jumpButton.style.height = '80px';
        this.jumpButton.style.borderRadius = '40px';
        this.jumpButton.style.backgroundColor = 'rgba(100, 200, 255, 0.5)';
        this.jumpButton.style.border = '2px solid rgba(255, 255, 255, 0.8)'; // Make border more visible
        this.jumpButton.style.pointerEvents = 'auto';
        this.jumpButton.style.display = 'flex';
        this.jumpButton.style.justifyContent = 'center';
        this.jumpButton.style.alignItems = 'center';
        this.jumpButton.style.fontSize = '18px'; // Larger text
        this.jumpButton.style.fontWeight = 'bold';
        this.jumpButton.style.color = 'white';
        this.jumpButton.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)'; // Add text shadow for readability
        this.jumpButton.innerText = 'JUMP';
        
        // Create crouch button
        this.crouchButton = document.createElement('div');
        this.crouchButton.className = 'crouch-button';
        this.crouchButton.style.position = 'absolute';
        this.crouchButton.style.bottom = '100px';
        this.crouchButton.style.right = '80px';
        this.crouchButton.style.width = '80px';
        this.crouchButton.style.height = '80px';
        this.crouchButton.style.borderRadius = '40px';
        this.crouchButton.style.backgroundColor = 'rgba(255, 150, 100, 0.5)';
        this.crouchButton.style.border = '2px solid rgba(255, 255, 255, 0.8)'; // Make border more visible
        this.crouchButton.style.pointerEvents = 'auto';
        this.crouchButton.style.display = 'flex';
        this.crouchButton.style.justifyContent = 'center';
        this.crouchButton.style.alignItems = 'center';
        this.crouchButton.style.fontSize = '18px'; // Larger text
        this.crouchButton.style.fontWeight = 'bold';
        this.crouchButton.style.color = 'white';
        this.crouchButton.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)'; // Add text shadow for readability
        this.crouchButton.innerText = 'CROUCH';
        
        this.container.appendChild(this.jumpButton);
        this.container.appendChild(this.crouchButton);
        
        // Add debug info element
        const debugInfo = document.createElement('div');
        debugInfo.className = 'mobile-debug-info';
        debugInfo.style.position = 'absolute';
        debugInfo.style.top = '10px';
        debugInfo.style.left = '10px';
        debugInfo.style.padding = '5px';
        debugInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        debugInfo.style.color = 'white';
        debugInfo.style.fontSize = '12px';
        debugInfo.style.zIndex = '1001';
        debugInfo.style.pointerEvents = 'none';
        debugInfo.innerText = 'Mobile Controls Active';
        this.container.appendChild(debugInfo);
    }
    
    /**
     * Attach the mobile controls to the DOM and initialize
     */
    public attach(): void {
        document.body.appendChild(this.container);
        
        // Initialize nipplejs joystick
        this.initJoystick();
        
        // Set up the camera controls and button handlers
        this.setupCameraControls();
        this.setupButtonHandlers();
        
        // Add debug message to confirm attachment
        console.log("Mobile controls attached");
        
        // Add camera drag area for visibility
        const cameraArea = document.createElement('div');
        cameraArea.className = 'camera-control-area';
        cameraArea.style.position = 'absolute';
        cameraArea.style.top = '0';
        cameraArea.style.right = '0';
        cameraArea.style.width = '50%';
        cameraArea.style.height = '100%';
        cameraArea.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        cameraArea.style.pointerEvents = 'auto';
        cameraArea.style.zIndex = '999';
        cameraArea.style.border = '1px dashed rgba(255, 255, 255, 0.2)';
        
        // Update debug info when touched
        cameraArea.addEventListener('touchstart', (event) => {
            const debugEl = this.container.querySelector('.mobile-debug-info');
            if (debugEl) {
                debugEl.textContent = 'Camera control active';
            }
        });
        
        cameraArea.addEventListener('touchend', (event) => {
            const debugEl = this.container.querySelector('.mobile-debug-info');
            if (debugEl) {
                debugEl.textContent = 'Mobile Controls Active';
            }
        });
        
        this.container.appendChild(cameraArea);
    }
    
    /**
     * Initialize the nipplejs joystick
     */
    private initJoystick(): void {
        // Find the joystick zone element
        const zone = this.container.querySelector('.joystick-zone') as HTMLElement;
        
        if (zone) {
            console.log("Creating nipplejs joystick in zone:", zone);
            
            // Create the joystick with better visibility settings
            this.joystick = nipplejs.create({
                zone: zone,
                mode: 'static',
                position: { left: '50%', top: '50%' },
                color: 'white',
                size: 100,
                lockX: false,
                lockY: false,
                dynamicPage: true,
                fadeTime: 0, // No fade-out animation
                restOpacity: 0.8, // Higher opacity when not active
            });
            
            // Set up event handlers
            this.joystick.on('move', (evt, data) => {
                if (data.vector && data.vector.x !== undefined && data.vector.y !== undefined) {
                    // Nipplejs returns vector with values between -1 and 1
                    // Forward is UP in nipplejs which is negative Z in our 3D world
                    this.movementDirection.set(
                        data.vector.x,
                        -data.vector.y // Invert Y axis for 3D space
                    );
                    
                    // Update debug info if present
                    const debugEl = this.container.querySelector('.mobile-debug-info');
                    if (debugEl) {
                        debugEl.textContent = `Joystick: ${data.vector.x.toFixed(2)}, ${data.vector.y.toFixed(2)}`;
                    }
                }
            });
            
            this.joystick.on('end', () => {
                // Reset movement direction when joystick is released
                this.movementDirection.set(0, 0);
                
                // Update debug info
                const debugEl = this.container.querySelector('.mobile-debug-info');
                if (debugEl) {
                    debugEl.textContent = 'Mobile Controls Active';
                }
            });
            
            console.log("Joystick initialized:", this.joystick);
        } else {
            console.error("Failed to find joystick zone element");
        }
    }
    
    /**
     * Set up camera control touch handling
     */
    private setupCameraControls(): void {
        // Get the entire document for touch events to ensure we don't miss any
        document.addEventListener('touchstart', this.handleCameraTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleCameraTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleCameraTouchEnd.bind(this), { passive: false });
        document.addEventListener('touchcancel', this.handleCameraTouchEnd.bind(this), { passive: false });
        
        console.log("Camera controls set up on document");
    }
    
    /**
     * Set up button handlers
     */
    private setupButtonHandlers(): void {
        // Jump button events
        this.jumpButton.addEventListener('touchstart', (event) => {
            event.preventDefault();
            this.jumpActive = true;
            this.jumpButton.style.backgroundColor = 'rgba(100, 200, 255, 0.8)';
        });
        
        this.jumpButton.addEventListener('touchend', (event) => {
            event.preventDefault();
            this.jumpActive = false;
            this.jumpButton.style.backgroundColor = 'rgba(100, 200, 255, 0.5)';
        });
        
        // Crouch button events
        this.crouchButton.addEventListener('touchstart', (event) => {
            event.preventDefault();
            this.crouchActive = true;
            this.crouchButton.style.backgroundColor = 'rgba(255, 150, 100, 0.8)';
        });
        
        this.crouchButton.addEventListener('touchend', (event) => {
            event.preventDefault();
            this.crouchActive = false;
            this.crouchButton.style.backgroundColor = 'rgba(255, 150, 100, 0.5)';
        });
    }
    
    /**
     * Handle camera touch start
     */
    private handleCameraTouchStart(event: TouchEvent): void {
        // Prevent default behavior only for camera control touches
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            // Skip if we're already tracking a touch for camera
            if (this.cameraTouchId !== null) continue;
            
            // Check if touch is in the right half of the screen
            const isRightHalf = touch.clientX > window.innerWidth / 2;
            
            // Skip touches on control elements
            const targetEl = touch.target as Element;
            const isControl = 
                targetEl === this.jumpButton || 
                targetEl === this.crouchButton || 
                targetEl.classList.contains('joystick-zone') ||
                !!targetEl.closest('.nipple');
            
            if (isRightHalf && !isControl) {
                this.cameraTouchId = touch.identifier;
                this.previousCameraPos = { x: touch.clientX, y: touch.clientY };
                
                // Update debug info
                const debugEl = this.container.querySelector('.mobile-debug-info');
                if (debugEl) {
                    debugEl.textContent = `Camera start: ${touch.clientX}, ${touch.clientY}`;
                }
                
                event.preventDefault();
                break; // Only track one camera touch
            }
        }
    }
    
    /**
     * Handle camera touch move
     */
    private handleCameraTouchMove(event: TouchEvent): void {
        // If we're not tracking a camera touch, exit early
        if (this.cameraTouchId === null) return;
        
        // Try to find our active camera touch
        let cameraTouch = null;
        for (let i = 0; i < event.touches.length; i++) {
            if (event.touches[i].identifier === this.cameraTouchId) {
                cameraTouch = event.touches[i];
                break;
            }
        }
        
        // If we found our camera touch, process it
        if (cameraTouch) {
            const currentPos = { x: cameraTouch.clientX, y: cameraTouch.clientY };
            const deltaX = currentPos.x - this.previousCameraPos.x;
            const deltaY = currentPos.y - this.previousCameraPos.y;
            
            // Call camera rotation callback if set
            if (this.cameraRotateCallback && (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)) {
                this.cameraRotateCallback(deltaX, deltaY);
                
                // Update debug info
                const debugEl = this.container.querySelector('.mobile-debug-info');
                if (debugEl) {
                    debugEl.textContent = `Camera move: ${deltaX.toFixed(0)}, ${deltaY.toFixed(0)}`;
                }
            }
            
            this.previousCameraPos = currentPos;
            event.preventDefault();
        } else {
            // Lost our touch somehow, reset
            this.cameraTouchId = null;
        }
    }
    
    /**
     * Handle camera touch end
     */
    private handleCameraTouchEnd(event: TouchEvent): void {
        // Check if our tracked camera touch has ended
        for (let i = 0; i < event.changedTouches.length; i++) {
            if (event.changedTouches[i].identifier === this.cameraTouchId) {
                this.cameraTouchId = null;
                
                // Update debug info
                const debugEl = this.container.querySelector('.mobile-debug-info');
                if (debugEl) {
                    debugEl.textContent = 'Camera control released';
                    
                    // Reset to default message after a short delay
                    setTimeout(() => {
                        if (debugEl) {
                            debugEl.textContent = 'Mobile Controls Active';
                        }
                    }, 1000);
                }
                
                break;
            }
        }
    }
    
    /**
     * Detach the mobile controls from the DOM
     */
    public detach(): void {
        // Destroy the joystick
        if (this.joystick) {
            this.joystick.destroy();
            this.joystick = null;
        }
        
        // Remove the container
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
    }
    
    /**
     * Set the callback for camera rotation
     * @param callback Function to call when camera rotation occurs
     */
    public setCameraRotateCallback(callback: (deltaX: number, deltaY: number) => void): void {
        this.cameraRotateCallback = callback;
    }
    
    /**
     * Get the current input state for the player
     * @returns Object with movement and button states
     */
    public getInputState(): { w: boolean; a: boolean; s: boolean; d: boolean; space: boolean; shift: boolean } {
        // Convert joystick direction to WASD
        const w = this.movementDirection.y > 0.3;
        const s = this.movementDirection.y < -0.3;
        const a = this.movementDirection.x < -0.3;
        const d = this.movementDirection.x > 0.3;
        
        return {
            w,
            a,
            s,
            d,
            space: this.jumpActive,
            shift: this.crouchActive
        };
    }
} 