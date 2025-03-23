import * as THREE from 'three';
import { MobileControls } from './MobileControls';
import { TestLevels } from './TestLevels';
import { Level } from './Level';
import { LevelRenderer } from './LevelRenderer';

export class Game {

    public level: Level | null = null;
    public levelRenderer: LevelRenderer | null = null;
    
    // Add fixed framerate properties
    public targetFPS: number = 60;
    public timestep: number = 1000 / this.targetFPS; // Fixed timestep in milliseconds (60 FPS)
    public lastUpdateTime: number = 0;
    public accumulatedTime: number = 0;

    public isDragging: boolean = false;
    public previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };
    public inputKeys: { [key: string]: boolean } = {};

    public highPerformanceMode: boolean = true;

    // Add mobile controls
    private mobileControls: MobileControls | null = null;
    private isMobile: boolean = false;

    constructor() {
        // Initialize levelRenderer first
        this.level = new Level();
        this.levelRenderer = new LevelRenderer(this.level);
        this.level.levelRenderer = this.levelRenderer;
        
        // Detect mobile devices and set performance mode accordingly
        this.detectDeviceCapabilities();
        
        // Initialize AFTER renderer is set up
        this.init();
        
        // Load the default level (Jungle Gym)
        this.switchLevel(0);
        
        // Setup controls
        this.setupControls();
        
        // Start the game loop
        this.lastUpdateTime = performance.now();
        requestAnimationFrame(this.update.bind(this));
    }

    /**
     * Detect device capabilities and set performance mode
     */
    private detectDeviceCapabilities(): void {
        // Enhanced mobile detection - check both user agent and screen size
        const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Chrome DevTools mobile emulation often has small screen size
        const sizeMobile = window.innerWidth <= 900;
        // Set mobile detection flag
        this.isMobile = userAgentMobile || sizeMobile;
        
        // Force mobile mode for debugging
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('forceMobile')) {
            this.isMobile = true;
            console.log("Forcing mobile mode via URL parameter");
        }
        
        // Set performance mode based on device - default to high performance on desktop
        //this.highPerformanceMode = !this.isMobile;
        
        console.log(`Device detected as ${this.isMobile ? 'mobile' : 'desktop'}, using ${this.highPerformanceMode ? 'high' : 'low'} performance mode`);
        console.log(`Screen dimensions: ${window.innerWidth}x${window.innerHeight}, devicePixelRatio: ${window.devicePixelRatio}`);

        this.levelRenderer?.detectDeviceCapabilities(this.highPerformanceMode);
    }


    /**
     * Set up keyboard input tracking (only track state, don't update player here)
     */
    public setupControls(): void {
        // Mouse controls for camera rotation
        let domElement = this.getDomElement();
        domElement.addEventListener('mousedown', (event) => {
            this.isDragging = true;
            this.previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
            
            // Request pointer lock on mouse down for desktop fullscreen
            if (document.fullscreenElement && !document.pointerLockElement) {
                this.getDomElement().requestPointerLock();
            }
        });

        domElement.addEventListener('mousemove', (event) => {
            // If pointer is locked (fullscreen mode)
            if (document.pointerLockElement === domElement) {
                // Use movement instead of absolute position
                const deltaMove = {
                    x: event.movementX,
                    y: event.movementY
                };
                
                this.levelRenderer!.cameraTheta += deltaMove.x * 0.002; // Adjusted sensitivity
                // Invert Y movement in fullscreen mode for more intuitive control
                this.levelRenderer!.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.levelRenderer!.cameraPhi - deltaMove.y * 0.002));
            }
            // Regular dragging (outside fullscreen)
            else if (this.isDragging) {
                const deltaMove = {
                    x: event.clientX - this.previousMousePosition.x,
                    y: event.clientY - this.previousMousePosition.y
                };

                this.levelRenderer!.cameraTheta += deltaMove.x * 0.01;
                // Keep Y movement non-inverted for regular dragging
                this.levelRenderer!.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.levelRenderer!.cameraPhi + deltaMove.y * 0.01));

                this.previousMousePosition = {
                    x: event.clientX,
                    y: event.clientY
                };
            }
        });

        domElement.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Add pointer lock change and error event listeners
        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
        document.addEventListener('pointerlockerror', () => {
            console.error('Pointer lock error');
        });

        // Wheel for zoom
        domElement.addEventListener('wheel', (event) => {
            this.levelRenderer!.cameraDistance = Math.max(4, Math.min(20, this.levelRenderer!.cameraDistance + event.deltaY * 0.01));
        });

        // Set up keyboard input tracking (only track state, don't update player here)
        this.inputKeys = {};
        
        window.addEventListener('keydown', (event) => {
            this.inputKeys[event.key.toLowerCase()] = true;
        });
        
        window.addEventListener('keyup', (event) => {
            this.inputKeys[event.key.toLowerCase()] = false;
        });

        // Use 'T' key to toggle performance mode instead of just toon shadows
        window.addEventListener('keydown', (event) => {
            if (event.key === 't' || event.key === 'T') {
                // Only allow toggling on desktop devices
                if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                    this.togglePerformanceMode();
                    console.log(`Toggled to ${this.highPerformanceMode ? 'high' : 'low'} performance mode`);
                }
            }
        });

        // Add number key listeners for level switching
        window.addEventListener('keydown', (event) => {
            if (event.key === '1') {
                console.log("Switching to Jungle Gym level");
                this.switchLevel(0);
            } else if (event.key === '2') {
                console.log("Switching to Simple Test level");
                this.switchLevel(1);
            }
        });
    }


    /**
     * Toggle between high and low performance modes
     */
    public togglePerformanceMode(): void {
        this.setPerformanceMode(!this.highPerformanceMode);
    }

    /**
     * Manually set performance mode
     */
    public setPerformanceMode(highPerformance: boolean): void {
        if (this.highPerformanceMode === highPerformance) return;
        
        this.highPerformanceMode = highPerformance;
        
        
        console.log(`Switched to ${highPerformance ? 'high' : 'low'} performance mode`);
    }

    /**
     * Setup mobile controls
     */
    private setupMobileControls(): void {
        // Create new mobile controls
        this.mobileControls = new MobileControls();
        
        // Set the camera rotation callback with increased sensitivity for mobile
        this.mobileControls.setCameraRotateCallback((deltaX, deltaY) => {
            // Adjust camera angles based on touch movement - use higher sensitivity for mobile
            const sensitivity = 0.02; // Doubled from 0.01
            this.levelRenderer!.cameraTheta += deltaX * sensitivity;
            // INVERTED Y-axis for more natural camera control - using negative deltaY
            this.levelRenderer!.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.levelRenderer!.cameraPhi - deltaY * sensitivity));
            
            // Log camera rotation for debugging
            console.log(`Camera rotation: theta=${this.levelRenderer!.cameraTheta.toFixed(2)}, phi=${this.levelRenderer!.cameraPhi.toFixed(2)}`);
        });
        
        // Set the zoom callback
        this.mobileControls.setZoomCallback((zoomDelta) => {
            // Adjust camera distance with higher sensitivity
            this.levelRenderer!.cameraDistance = Math.max(2, Math.min(20, this.levelRenderer!.cameraDistance - zoomDelta * 2)); // Multiplied by 2 for more sensitivity
            console.log(`Camera zoom: distance=${this.levelRenderer!.cameraDistance.toFixed(2)}`);
        });
        
        // Attach the controls to the DOM
        this.mobileControls.attach();
        
        console.log("Mobile controls initialized", this.mobileControls);
        
        // Debug helper for DevTools: force mobile controls visibility
        const isDevToolsOpen = window.navigator.userAgent.includes('Chrome') && 
                             (window.outerHeight - window.innerHeight > 100 || 
                              window.outerWidth - window.innerWidth > 100);
        
        if (isDevToolsOpen || window.navigator.userAgent.includes('Chrome')) {
            const mobileControlsDiv = document.querySelector('.mobile-controls');
            if (mobileControlsDiv) {
                console.log("Forcing mobile controls visibility for Chrome DevTools");
                (mobileControlsDiv as HTMLElement).style.display = 'block';
                (mobileControlsDiv as HTMLElement).style.visibility = 'visible';
                
                // Make sure joystick is visible
                const joystickZone = document.querySelector('.joystick-zone');
                if (joystickZone) {
                    (joystickZone as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                    console.log("Joystick zone visibility enhanced");
                }
                
                // Also make camera control area visible
                const cameraArea = document.querySelector('.camera-control-area');
                if (cameraArea) {
                    (cameraArea as HTMLElement).style.backgroundColor = 'rgba(255, 0, 255, 0.1)';
                    console.log("Camera control area visibility enhanced");
                }
            }
        }
    }

    public init(): void {
        // Renderer setup
        document.body.appendChild(this.getDomElement());
        
        // Add fullscreen button for desktop users
        if (!this.isMobile) {
            this.addDesktopFullscreenButton();
        }
        
        // Register window resize handler in Game class (not in LevelRenderer)
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Ensure mobile controls are set up immediately after initialization if on mobile
        if (this.isMobile && !this.mobileControls) {
            this.setupMobileControls();
        }
    }

    public getDomElement(): HTMLElement {
        return this.levelRenderer!.renderer.domElement;
    }

    /**
     * Handle pointer lock change
     */
    private onPointerLockChange(): void {
        if (document.pointerLockElement === this.getDomElement()) {
            console.log('Pointer locked - fullscreen game mode active');
            // Show escape message for desktop fullscreen
            this.showEscapeMessage(true);
        } else {
            console.log('Pointer lock released');
            // Hide escape message
            this.showEscapeMessage(false);
        }
    }
    
    /**
     * Show/hide escape fullscreen message
     */
    private showEscapeMessage(show: boolean): void {
        let escapeMsg = document.getElementById('escape-message');
        
        if (show) {
            if (!escapeMsg) {
                escapeMsg = document.createElement('div');
                escapeMsg.id = 'escape-message';
                escapeMsg.style.position = 'fixed';
                escapeMsg.style.top = '10px';
                escapeMsg.style.right = '10px';
                escapeMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                escapeMsg.style.color = 'white';
                escapeMsg.style.padding = '5px 10px';
                escapeMsg.style.borderRadius = '5px';
                escapeMsg.style.fontFamily = 'Arial, sans-serif';
                escapeMsg.style.fontSize = '12px';
                escapeMsg.style.zIndex = '9999';
                escapeMsg.textContent = 'Press ESC to exit fullscreen';
                document.body.appendChild(escapeMsg);
            } else {
                escapeMsg.style.display = 'block';
            }
        } else if (escapeMsg) {
            escapeMsg.style.display = 'none';
        }
    }

    public update(): void {
        const currentTime = performance.now();
        
        if (this.lastUpdateTime === 0) {
            this.lastUpdateTime = currentTime;
            requestAnimationFrame(this.update.bind(this));
            return;
        }
        
        // Calculate elapsed time since last update
        const elapsedTime = currentTime - this.lastUpdateTime;
        this.accumulatedTime += elapsedTime;
        this.lastUpdateTime = currentTime;
        
        // Process as many fixed updates as needed to catch up
        let updated = false;
        while (this.accumulatedTime >= this.timestep) {
            // Consume one timestep's worth of accumulated time
            this.accumulatedTime -= this.timestep;
            
            // Collect inputs to pass to level
            const inputs = this.collectInputs();
            
            // Execute the fixed update with inputs
            this.level!.fixedUpdate(inputs);
            updated = true;
            
            // Prevent spiral of death by capping accumulated time
            if (this.accumulatedTime > this.timestep * 5) {
                this.accumulatedTime = this.timestep * 5;
            }
        }
        
        // Only render if we did at least one fixed update
        if (updated) {
            // Update camera
            this.levelRenderer!.updateCamera();
            this.levelRenderer!.render();
        }
        
        // Continue the game loop
        requestAnimationFrame(this.update.bind(this));
    }
    
    /**
     * Collect all inputs to pass to the level
     */
    private collectInputs(): { playerForward: THREE.Vector3, playerInput: any } {
        // Calculate the forward vector using cameraPhi and cameraTheta
        const forwardX = -Math.sin(this.levelRenderer!.cameraPhi) * Math.cos(this.levelRenderer!.cameraTheta);
        const forwardZ = -Math.sin(this.levelRenderer!.cameraPhi) * Math.sin(this.levelRenderer!.cameraTheta);
        const playerForward = new THREE.Vector3(forwardX, 0, forwardZ);
        
        // Get mobile input if available
        let mobileInput = { w: false, a: false, s: false, d: false, space: false, shift: false };
        
        if (this.isMobile && this.mobileControls) {
            // Get input from mobile controls
            const direction = this.mobileControls.movementDirection;
            
            // Convert joystick direction to WASD
            if (direction.length() > 0.1) {
                // Forward/backward based on y component
                mobileInput.w = direction.y > 0.3;
                mobileInput.s = direction.y < -0.3;
                
                // Left/right based on x component
                mobileInput.a = direction.x < -0.3;
                mobileInput.d = direction.x > 0.3;
            }
            
            // Get jump and crouch status from mobile controls
            const buttonState = this.mobileControls.getInputState();
            mobileInput.space = buttonState.space;
            mobileInput.shift = buttonState.shift;
        }
        
        // Combine keyboard and mobile inputs
        const playerInput = {
            w: this.inputKeys['w'] || mobileInput.w || false,
            a: this.inputKeys['a'] || mobileInput.a || false,
            s: this.inputKeys['s'] || mobileInput.s || false,
            d: this.inputKeys['d'] || mobileInput.d || false,
            space: this.inputKeys[' '] || mobileInput.space || false,
            shift: this.inputKeys['shift'] || mobileInput.shift || false
        };
        
        return { playerForward, playerInput };
    }

    /**
     * Add a fullscreen button for desktop users
     */
    public addDesktopFullscreenButton(): void {
        // Create container for fullscreen button and controls
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '10px';
        container.style.right = '10px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-end'; // Align items to the right
        container.style.gap = '10px';
        container.style.zIndex = '9999';
        
        // Create fullscreen button
        const fullscreenBtn = document.createElement('div');
        fullscreenBtn.className = 'desktop-fullscreen-button';
        fullscreenBtn.style.width = '44px';
        fullscreenBtn.style.height = '44px';
        fullscreenBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        fullscreenBtn.style.borderRadius = '5px';
        fullscreenBtn.style.display = 'flex';
        fullscreenBtn.style.justifyContent = 'center';
        fullscreenBtn.style.alignItems = 'center';
        fullscreenBtn.style.cursor = 'pointer';
        fullscreenBtn.style.border = '1px solid rgba(255, 255, 255, 0.5)';
        fullscreenBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        
        // Create an SVG icon for fullscreen
        fullscreenBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>`;
        
        // Create controls hint panel
        const controlsHint = document.createElement('div');
        controlsHint.className = 'controls-hint';
        controlsHint.style.width = '200px'; // Set a fixed width for the controls hint
        controlsHint.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        controlsHint.style.color = 'white';
        controlsHint.style.padding = '10px';
        controlsHint.style.borderRadius = '5px';
        controlsHint.style.fontSize = '12px';
        controlsHint.style.fontFamily = 'Arial, sans-serif';
        controlsHint.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        controlsHint.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        controlsHint.style.lineHeight = '1.5';
        controlsHint.style.transition = 'opacity 0.3s';
        
        // Add control instructions
        controlsHint.innerHTML = `
            <div style="margin-bottom: 5px; font-weight: bold;">Controls:</div>
            <div>WASD - Move</div>
            <div>SPACE - Jump/Grab rope</div>
            <div>SHIFT - Crouch/Release rope</div>
            <div>Mouse - Look around</div>
            <div>Mouse wheel - Zoom</div>
        `;
        
        // Add elements to container
        container.appendChild(fullscreenBtn);
        container.appendChild(controlsHint);
        
        // Add click event to toggle fullscreen and pointer lock
        fullscreenBtn.addEventListener('click', () => {
            const docEl = document.documentElement;
            
            if (!document.fullscreenElement) {
                // Enter fullscreen
                docEl.requestFullscreen().then(() => {
                    // Request pointer lock after fullscreen
                    setTimeout(() => {
                        if (this.getDomElement() && !document.pointerLockElement) {
                            this.getDomElement().requestPointerLock();
                        }
                    }, 100);
                }).catch(err => {
                    console.error('Fullscreen error:', err);
                });
            } else {
                // Exit fullscreen
                document.exitFullscreen().catch(err => {
                    console.error('Exit fullscreen error:', err);
                });
                
                // Exit pointer lock if active
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
            }
        });
        
        document.body.appendChild(container);
        
        // Update visibility based on fullscreen state
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                container.style.opacity = '0';
                setTimeout(() => {
                    container.style.display = 'none';
                }, 1000);
            } else {
                container.style.display = 'flex';
                container.style.opacity = '1';
            }
        });
        
        // Add hover effect to show/hide controls hint
        container.addEventListener('mouseenter', () => {
            controlsHint.style.opacity = '1';
        });
        
        container.addEventListener('mouseleave', () => {
            if (!document.fullscreenElement) {
                controlsHint.style.opacity = '0.3';
            }
        });
        
        // Initially set controls hint to semi-transparent
        controlsHint.style.opacity = '0.3';
    }

    public toggleToonShadows(enabled: boolean): void {
        // This now just becomes a passthrough to performance toggle
        if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            this.togglePerformanceMode();
        }
    }

    // Add method to set target FPS
    public setTargetFPS(fps: number): void {
        this.targetFPS = fps;
        this.timestep = 1000 / fps;
    }

    public onWindowResize(): void {
        // Handle DOM-related resize operations
        if (this.levelRenderer) {
            // Notify the LevelRenderer about the resize
            this.levelRenderer.handleResize(window.innerWidth, window.innerHeight);
            
            // Set appropriate pixel ratio based on performance mode
            if (this.highPerformanceMode) {
                this.levelRenderer.renderer.setPixelRatio(window.devicePixelRatio);
            } else {
                this.levelRenderer.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
            }
        }
    }

    /**
     * Switch to a different level
     * @param levelIndex The index of the level to switch to
     */
    public switchLevel(levelIndex: number): void {
        // Remove the old renderer from DOM first if it exists
        if (this.levelRenderer) {
            document.body.removeChild(this.levelRenderer.renderer.domElement);
        }
        
        // Create a brand new Level and LevelRenderer
        this.level = new Level();
        this.levelRenderer = new LevelRenderer(this.level);
        this.level.levelRenderer = this.levelRenderer;
        
        // Add the new renderer's canvas to the DOM
        document.body.appendChild(this.levelRenderer.renderer.domElement);
        
        // Apply current performance settings
        this.levelRenderer.detectDeviceCapabilities(this.highPerformanceMode);
        
        // Create a player
        const player = this.level.addPlayer('local', true);
        
        // Load the appropriate level
        switch (levelIndex) {
            case 0:
                TestLevels.createJungleGymTest(this.level);
                // Position player on starting platform
                player.move(new THREE.Vector3(0, 5, 0));
                break;
            case 1:
                TestLevels.createSimpleTestLevel(this.level);
                // Position player on the first platform
                player.move(new THREE.Vector3(0, 55, 0));
                break;
            default:
                console.error(`Unknown level index: ${levelIndex}`);
                TestLevels.createJungleGymTest(this.level);
                player.move(new THREE.Vector3(0, 5, 0));
        }
        
        // Re-initialize any DOM-related controls and events
        this.setupControls();
        
        console.log(`Switched to level ${levelIndex}`);
    }
} 
