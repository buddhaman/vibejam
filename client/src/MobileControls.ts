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
    
    // Zoom control state
    private zoomTouchId1: number | null = null;
    private zoomTouchId2: number | null = null;
    private previousZoomDistance: number = 0;
    
    // Button states
    private jumpActive: boolean = false;
    private crouchActive: boolean = false;
    
    // Movement direction - normalized vector represented as x,z components (y is up)
    public movementDirection: THREE.Vector2 = new THREE.Vector2(0, 0);
    
    // Callbacks
    private cameraRotateCallback: ((deltaX: number, deltaY: number) => void) | null = null;
    private zoomCallback: ((zoomDelta: number) => void) | null = null;
    
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
        this.jumpButton.style.border = '2px solid rgba(255, 255, 255, 0.8)';
        this.jumpButton.style.pointerEvents = 'auto';
        this.jumpButton.style.display = 'flex';
        this.jumpButton.style.justifyContent = 'center';
        this.jumpButton.style.alignItems = 'center';
        this.jumpButton.style.fontSize = '18px';
        this.jumpButton.style.fontWeight = 'bold';
        this.jumpButton.style.color = 'white';
        this.jumpButton.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)';
        this.jumpButton.style.zIndex = '9999'; // Ensure highest z-index
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
        this.crouchButton.style.border = '2px solid rgba(255, 255, 255, 0.8)';
        this.crouchButton.style.pointerEvents = 'auto';
        this.crouchButton.style.display = 'flex';
        this.crouchButton.style.justifyContent = 'center';
        this.crouchButton.style.alignItems = 'center';
        this.crouchButton.style.fontSize = '18px';
        this.crouchButton.style.fontWeight = 'bold';
        this.crouchButton.style.color = 'white';
        this.crouchButton.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)';
        this.crouchButton.style.zIndex = '9999'; // Ensure highest z-index
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
        
        // Remove and re-append buttons to ensure they're on top
        if (this.jumpButton.parentNode) {
            this.jumpButton.parentNode.removeChild(this.jumpButton);
        }
        if (this.crouchButton.parentNode) {
            this.crouchButton.parentNode.removeChild(this.crouchButton);
        }
        this.container.appendChild(this.jumpButton);
        this.container.appendChild(this.crouchButton);
        
        // Set up button handlers
        this.setupButtonHandlers();
        
        // Add debug message to confirm attachment
        console.log("Mobile controls attached");
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
                    // Forward is UP in nipplejs which maps correctly to our 3D world
                    this.movementDirection.set(
                        data.vector.x,
                        data.vector.y  // Remove the negative sign here
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
        console.log("Setting up button handlers");
        
        // Log button visibility to help debugging
        console.log("Jump button:", this.jumpButton);
        console.log("Crouch button:", this.crouchButton);
        
        // Button touch events need capture phase to ensure they're handled first
        this.jumpButton.addEventListener('touchstart', (event) => {
            console.log("Jump button touchstart");
            event.stopPropagation();
            event.preventDefault();
            this.jumpActive = true;
            this.jumpButton.style.backgroundColor = 'rgba(100, 200, 255, 0.8)';
            
            // Update debug info
            const debugEl = this.container.querySelector('.mobile-debug-info');
            if (debugEl) {
                debugEl.textContent = 'JUMP pressed';
            }
        }, { capture: true });
        
        this.jumpButton.addEventListener('touchend', (event) => {
            console.log("Jump button touchend");
            event.stopPropagation();
            event.preventDefault();
            this.jumpActive = false;
            this.jumpButton.style.backgroundColor = 'rgba(100, 200, 255, 0.5)';
        }, { capture: true });
        
        // Crouch button events
        this.crouchButton.addEventListener('touchstart', (event) => {
            console.log("Crouch button touchstart");
            event.stopPropagation();
            event.preventDefault();
            this.crouchActive = true;
            this.crouchButton.style.backgroundColor = 'rgba(255, 150, 100, 0.8)';
            
            // Update debug info
            const debugEl = this.container.querySelector('.mobile-debug-info');
            if (debugEl) {
                debugEl.textContent = 'CROUCH pressed';
            }
        }, { capture: true });
        
        this.crouchButton.addEventListener('touchend', (event) => {
            console.log("Crouch button touchend");
            event.stopPropagation();
            event.preventDefault();
            this.crouchActive = false;
            this.crouchButton.style.backgroundColor = 'rgba(255, 150, 100, 0.5)';
        }, { capture: true });
        
        // Add global touch logging to debug issues
        document.addEventListener('touchstart', (e) => {
            const target = e.target as Element;
            const targetInfo = target ? `${target.tagName}${target.className ? '.' + target.className : ''}` : 'unknown';
            console.log(`Global touchstart: x=${e.touches[0].clientX}, y=${e.touches[0].clientY}, target=${targetInfo}`);
        }, { passive: true });
    }
    
    /**
     * Handle camera touch start
     */
    private handleCameraTouchStart(event: TouchEvent): void {
        // Process each new touch for potential camera control
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            // Skip if we're already tracking this specific touch ID
            if (touch.identifier === this.cameraTouchId) continue;
            
            // Get the element at the touch position
            const targetEl = document.elementFromPoint(touch.clientX, touch.clientY) as Element;
            
            // Check if touch is on any control element
            const isControlElement = targetEl && (
                targetEl.classList.contains('jump-button') ||
                targetEl.classList.contains('crouch-button') ||
                targetEl.classList.contains('joystick-zone') ||
                targetEl.closest('.jump-button') ||
                targetEl.closest('.crouch-button') ||
                targetEl.closest('.joystick-zone') ||
                targetEl.closest('.nipple')
            );
            
            // Skip touches on controls
            if (isControlElement) continue;
            
            // If we don't have a camera touch yet, use this one
            if (this.cameraTouchId === null) {
                this.cameraTouchId = touch.identifier;
                this.previousCameraPos = { x: touch.clientX, y: touch.clientY };
                
                console.log(`Camera touch started: ID=${touch.identifier}, pos=${touch.clientX},${touch.clientY}`);
                
                // Update debug info
                const debugEl = this.container.querySelector('.mobile-debug-info');
                if (debugEl) {
                    debugEl.textContent = `Camera start: ${touch.clientX}, ${touch.clientY}`;
                }
            }
        }
    }
    
    /**
     * Handle camera touch move
     */
    private handleCameraTouchMove(event: TouchEvent): void {
        // Process camera movement
        if (this.cameraTouchId !== null) {
            // Find our camera touch
            let cameraTouch = null;
            for (let i = 0; i < event.touches.length; i++) {
                if (event.touches[i].identifier === this.cameraTouchId) {
                    cameraTouch = event.touches[i];
                    break;
                }
            }
            
            if (cameraTouch) {
                const currentPos = { x: cameraTouch.clientX, y: cameraTouch.clientY };
                const deltaX = currentPos.x - this.previousCameraPos.x;
                const deltaY = currentPos.y - this.previousCameraPos.y;
                
                // Only process meaningful movements
                if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
                    if (this.cameraRotateCallback) {
                        this.cameraRotateCallback(deltaX, deltaY);
                        console.log(`Camera moved: dx=${deltaX}, dy=${deltaY}`);
                    }
                    
                    // Update debug info
                    const debugEl = this.container.querySelector('.mobile-debug-info');
                    if (debugEl) {
                        debugEl.textContent = `Camera move: ${deltaX.toFixed(0)}, ${deltaY.toFixed(0)}`;
                    }
                    
                    this.previousCameraPos = currentPos;
                }
            } else {
                // Lost the camera touch
                this.cameraTouchId = null;
            }
        }
    }
    
    /**
     * Handle camera touch end
     */
    private handleCameraTouchEnd(event: TouchEvent): void {
        // Check for zoom touches ending
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touchId = event.changedTouches[i].identifier;
            
            if (touchId === this.zoomTouchId1 || touchId === this.zoomTouchId2) {
                // Reset zoom tracking
                this.zoomTouchId1 = null;
                this.zoomTouchId2 = null;
                
                // Update debug info
                const debugEl = this.container.querySelector('.mobile-debug-info');
                if (debugEl) {
                    debugEl.textContent = 'Zoom ended';
                    
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
     * Set the callback for zoom
     * @param callback Function to call when zooming occurs
     */
    public setZoomCallback(callback: (zoomDelta: number) => void): void {
        this.zoomCallback = callback;
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