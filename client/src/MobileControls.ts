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
        // Add touch event listeners to the container
        this.container.addEventListener('touchstart', this.handleCameraTouchStart.bind(this), { passive: false });
        this.container.addEventListener('touchmove', this.handleCameraTouchMove.bind(this), { passive: false });
        this.container.addEventListener('touchend', this.handleCameraTouchEnd.bind(this), { passive: false });
        this.container.addEventListener('touchcancel', this.handleCameraTouchEnd.bind(this), { passive: false });
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
        // Only process touches in the right half of the screen for camera control
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            // Ignore touches on buttons or joystick zone
            if (touch.target === this.jumpButton || 
                touch.target === this.crouchButton || 
                (touch.target as Element).classList.contains('joystick-zone') ||
                (touch.target as Element).closest('.nipple')) {
                continue;
            }
            
            // For camera control, only use touches on the right half of the screen
            if (touch.clientX > window.innerWidth / 2 && this.cameraTouchId === null) {
                this.cameraTouchId = touch.identifier;
                this.previousCameraPos = { x: touch.clientX, y: touch.clientY };
            }
        }
    }
    
    /**
     * Handle camera touch move
     */
    private handleCameraTouchMove(event: TouchEvent): void {
        // Find the active camera touch and update camera
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            if (touch.identifier === this.cameraTouchId) {
                const currentPos = { x: touch.clientX, y: touch.clientY };
                const deltaX = currentPos.x - this.previousCameraPos.x;
                const deltaY = currentPos.y - this.previousCameraPos.y;
                
                // Call camera rotation callback if set
                if (this.cameraRotateCallback) {
                    this.cameraRotateCallback(deltaX, deltaY);
                }
                
                this.previousCameraPos = currentPos;
            }
        }
    }
    
    /**
     * Handle camera touch end
     */
    private handleCameraTouchEnd(event: TouchEvent): void {
        // Find the active camera touch and clear it
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            if (touch.identifier === this.cameraTouchId) {
                this.cameraTouchId = null;
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