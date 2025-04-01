import * as THREE from 'three';
import { MobileControls } from './MobileControls';
import { TestLevels } from './TestLevels';
import { Level } from './Level';
import { LevelRenderer } from './LevelRenderer';
import { ScreenTransition } from './ScreenTransition';
import { Player } from './Player';
import { Network } from './Network';
import { RoomType } from './Network';
import { BeginnerLevels } from './BeginnerLevels';
import { LevelEditor } from './LevelEditor';
import { Camera, CameraMode } from './Camera';
import { loadJSONLevel, tutorial_level } from './JSONLevels';

/**
 * Add an interface to define the custom properties on the window object
 */
interface CustomWindow extends Window {
    showIOSFullscreenPrompt?: () => boolean;
}

export class Game {

    public doLevelUpdate: boolean = true;
    public level: Level | null = null;
    public levelRenderer: LevelRenderer | null = null;
    public userName: string = "";
    
    // Add fixed framerate properties
    public targetFPS: number = 60;
    public timestep: number = 1000 / this.targetFPS; // Fixed timestep in milliseconds (60 FPS)
    public lastUpdateTime: number = 0;
    public accumulatedTime: number = 0;

    public isDragging: boolean = false;
    public previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };
    public inputKeys: { [key: string]: boolean } = {};

    public highPerformanceMode: boolean = true;
    
    // Add debug mode flag
    public debugMode: boolean = false;

    // Add mobile controls
    private mobileControls: MobileControls | null = null;
    private isMobile: boolean = false;
    
    // Add screen transition
    private screenTransition: ScreenTransition = new ScreenTransition();
    
    // Portal-related properties
    private portalParams: {[key: string]: string} = {};
    private isFromPortal: boolean = false;
    private fromPortalRef: string | null = null;

    // Add a property to track our event listeners
    private keydownListener: ((event: KeyboardEvent) => void) | null = null;
    private keyupListener: ((event: KeyboardEvent) => void) | null = null;

    // Add network player ID tracking
    private localPlayerId: string | null = null;
    public network: Network | null = null;

    // Add a property to the Game class
    public editorDraggingObject: boolean = false;

    // Add timer properties
    private levelTimerTicks: number = 0;
    private isLevelTimerRunning: boolean = false;
    private ticksPerSecond: number = 60; // Based on targetFPS
    private timerElement: HTMLElement | null = null;

    constructor() {
        // Set up basic components
        this.detectDeviceCapabilities();
        this.highPerformanceMode = true;
        
        // Check if we should run in level editor mode
        if (LevelEditor.shouldActivateEditor()) {
            console.log("Starting in level editor mode...");
            
            // Create level renderer for editor use
            this.level = new Level(this, -1);
            this.levelRenderer = new LevelRenderer(this.level, this.highPerformanceMode);
            this.level.levelRenderer = this.levelRenderer;
            
            // Initialize UI
            this.init();
            this.setupControlsOnce();
            
            // No player is created in editor mode
            
            // Initialize the editor
            new LevelEditor(this);
            
            // Start a simple render loop for the editor
            this.lastUpdateTime = performance.now();
            //requestAnimationFrame(this.updateEditor.bind(this));
            
            return; // Skip the rest of the initialization
        }
        
        // Continue with normal game initialization
        // Create network object - just initialize, don't connect yet
        this.network = new Network(this);
        
        // Check for existing username in localStorage or show prompt
        const savedUsername = localStorage.getItem('username');
        if (savedUsername) {
            this.userName = savedUsername;
            console.log(`Using saved username: ${this.userName}`);
        } else {
            // Set a temporary random username
            this.userName = this.generateRandomUsername();
            
            // Show username prompt after a short delay to let the game start
            setTimeout(() => this.showUsernamePrompt(), 500);
        }
        
        // Check for portal parameters - might contain username
        this.checkPortalParameters();
        
        try {
            // 1. CREATE LEVEL FIRST
            this.level = new Level(this, 0);
            this.levelRenderer = new LevelRenderer(this.level, this.highPerformanceMode);
            this.level.levelRenderer = this.levelRenderer;
            
            // Initialize UI and controls ONCE
            this.init();
            this.setupControlsOnce();
            
            // IMPORTANT: Load the level content BEFORE creating player
            this.loadLevelContent(0);
            
            // Create local player immediately with temporary ID and the username
            const localId = `local-${Date.now()}`;
            this.level.addPlayer(localId, true, this.userName);
            this.localPlayerId = localId;
            this.level.localPlayer?.setPosition(this.level.playerStartPosition);
            
            // IMPORTANT: Start the game loop immediately
            this.lastUpdateTime = performance.now();
            requestAnimationFrame(this.update.bind(this));
            
            // Now attempt to connect in the background
            // This won't block the game from starting
            this.connectInBackground();
        } catch (error) {
            console.error("Game initialization error:", error);
        }
    }

    /**
     * Create the timer overlay element
     */
    private createTimerOverlay(): void {
        // Create the timer element if it doesn't exist
        if (!this.timerElement) {
            this.timerElement = document.createElement('div');
            this.timerElement.id = 'game-timer-overlay';
            
            // Style the timer overlay - move to top-left corner
            Object.assign(this.timerElement.style, {
                position: 'fixed',
                top: '10px',
                left: '10px',  // Changed from right to left
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '5px',
                fontFamily: 'Arial, sans-serif',
                fontSize: '16px',
                transition: 'opacity 0.3s',
                zIndex: '1002',  // Increased z-index to be above mobile elements but below critical UI
                opacity: '0',  // Start hidden
                pointerEvents: 'none'  // Don't block mouse events
            });
            
            document.body.appendChild(this.timerElement);
        }
    }

    /**
     * Detect device capabilities and set flags
     */
    private detectDeviceCapabilities(): void {
        // Enhanced mobile detection - check user agent, screen size, and touch capability
        const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const sizeMobile = window.innerWidth <= 900;
        const hasTouchScreen = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        // Special check for iPad that might be reporting as desktop Safari
        const isIpadOS = /iPad|Macintosh/i.test(navigator.userAgent) && hasTouchScreen;
        
        // Set mobile detection flag - if any of these are true, consider it mobile
        this.isMobile = userAgentMobile || sizeMobile || isIpadOS || hasTouchScreen;
        
        // Handle URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('forceMobile')) {
            this.isMobile = true;
            console.log("Forcing mobile mode via URL parameter");
        }
        
        if (urlParams.has('forceDesktop')) {
            this.isMobile = false;
            console.log("Forcing desktop mode via URL parameter");
        }
        
        // Check for debug mode parameter
        if (urlParams.has('debug') || urlParams.has('debugMode')) {
            this.debugMode = true;
            console.log("Debug mode enabled via URL parameter");
        }
        
        // Log device information
        console.log(`Device detected as ${this.isMobile ? 'mobile' : 'desktop'}`);
        console.log(`Touch capabilities: ${hasTouchScreen ? 'yes' : 'no'}, iPad OS: ${isIpadOS ? 'yes' : 'no'}`);
        console.log(`Screen dimensions: ${window.innerWidth}x${window.innerHeight}, devicePixelRatio: ${window.devicePixelRatio}`);
    }

    /**
     * Set up controls once for the entire game lifecycle
     */
    private setupControlsOnce(): void {
        // Set up keyboard input tracking
        this.inputKeys = {};
        
        // Create the keyboard event listeners
        this.keydownListener = (event) => {
            this.inputKeys[event.key.toLowerCase()] = true;
            
            // Handle level switching
            if (event.key === '0') {
                this.switchLevel(0);
            } else if (event.key === '1') {
                this.switchLevel(1);
            } else if (event.key === '2') {
                this.switchLevel(2);
            } else if (event.key === 'p' || event.key === 'P') {
                this.showUsernamePrompt();
            }
            
            // Handle camera movement in editor mode
            if (this.levelRenderer?.camera.getMode() === CameraMode.FIRST_PERSON_FLYING) {
                this.handleCameraMovementKey(event.key, true);
            }
        };
        
        this.keyupListener = (event) => {
            this.inputKeys[event.key.toLowerCase()] = false;
            
            // Handle camera movement in editor mode
            if (this.levelRenderer?.camera.getMode() === CameraMode.FIRST_PERSON_FLYING) {
                this.handleCameraMovementKey(event.key, false);
            }
        };
        
        // Add the keyboard listeners
        window.addEventListener('keydown', this.keydownListener);
        window.addEventListener('keyup', this.keyupListener);
        
        // Mouse controls for camera rotation
        const domElement = this.getDomElement();

        
        // Create and store mouse event listeners
        domElement.addEventListener('mousedown', (event) => {
            this.isDragging = true;
            this.previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
            
            if (document.fullscreenElement && !document.pointerLockElement) {
                domElement.requestPointerLock();
            }
        });

        domElement.addEventListener('mousemove', (event) => {
            // Skip camera rotation if editor is dragging an object
            if (this.editorDraggingObject) return;
            
            // If pointer is locked (fullscreen mode)
            if (document.pointerLockElement === domElement) {
                // Use movement values directly (more precise)
                this.levelRenderer!.camera.rotate(event.movementX, event.movementY);
            }
            // Regular dragging (outside fullscreen)
            else if (this.isDragging) {
                const deltaMove = {
                    x: event.clientX - this.previousMousePosition.x,
                    y: event.clientY - this.previousMousePosition.y
                };

                // Use the new Camera rotate method
                this.levelRenderer!.camera.rotate(deltaMove.x, deltaMove.y);

                this.previousMousePosition = {
                    x: event.clientX,
                    y: event.clientY
                };
            }
        });

        domElement.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        domElement.addEventListener('wheel', (event) => {
            // Use the Camera zoom method
            this.levelRenderer!.camera.zoom(event.deltaY);
        });

        // Add pointer lock change and error event listeners
        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
        document.addEventListener('pointerlockerror', () => {
            console.error('Pointer lock error');
        });

        // Performance mode toggle
        window.addEventListener('keydown', (event) => {
            if (event.key === 't' || event.key === 'T') {
                if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                    this.togglePerformanceMode();
                }
            }
        });

        // For editor mode, add keyboard controls to move the camera
        // Add these to the setupControlsOnce method:
        window.addEventListener('keydown', (event) => {
            // Track key state
            this.inputKeys[event.key.toLowerCase()] = true;
            
            // Special handling for shift key
            if (event.key === 'Shift') {
                this.inputKeys['shift'] = true;
            }
            
            // Special handling for control key
            if (event.key === 'Control') {
                this.inputKeys['control'] = true;
            }
            
            // Special handling for alt key
            if (event.key === 'Alt') {
                this.inputKeys['alt'] = true;
            }
            
            // Process special keys
            if (event.key === '0') {
                this.switchLevel(0);
            } else if (event.key === '1') {
                this.switchLevel(1);
            } else if (event.key === '2') {
                this.switchLevel(2);
            } else if (event.key === 'p' || event.key === 'P') {
                this.showUsernamePrompt();
            }
            
            // Handle camera movement in editor mode
            if (this.levelRenderer?.camera.getMode() === CameraMode.FIRST_PERSON_FLYING) {
                this.handleCameraMovementKey(event.key, true);
            }
        });

        window.addEventListener('keyup', (event) => {
            // Track key state
            this.inputKeys[event.key.toLowerCase()] = false;
            
            // Special handling for shift key
            if (event.key === 'Shift') {
                this.inputKeys['shift'] = false;
            }
            
            // Special handling for control key
            if (event.key === 'Control') {
                this.inputKeys['control'] = false;
            }
            
            // Special handling for alt key
            if (event.key === 'Alt') {
                this.inputKeys['alt'] = false;
            }
            
            // Handle camera movement in editor mode
            if (this.levelRenderer?.camera.getMode() === CameraMode.FIRST_PERSON_FLYING) {
                this.handleCameraMovementKey(event.key, false);
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
        this.mobileControls = new MobileControls(this);
        
        // Set the camera rotation callback with increased sensitivity for mobile
        this.mobileControls.setCameraRotateCallback((deltaX, deltaY) => {
            // Adjust camera angles based on touch movement - use higher sensitivity for mobile
            const sensitivity = 0.02; // Doubled from 0.01
            this.levelRenderer!.camera.rotate(deltaX * sensitivity, -deltaY * sensitivity);
            
            // Log camera rotation for debugging
            console.log(`Camera rotation: theta=${this.levelRenderer!.camera.theta.toFixed(2)}, phi=${this.levelRenderer!.camera.phi.toFixed(2)}`);
        });
        
        // Set the zoom callback
        this.mobileControls.setZoomCallback((zoomDelta) => {
            // Adjust camera distance with higher sensitivity
            this.levelRenderer!.camera.zoom(zoomDelta * 2); // Multiplied by 2 for more sensitivity
            console.log(`Camera zoom: distance=${this.levelRenderer!.camera.distance.toFixed(2)}`);
        });
        
        // Attach the controls to the DOM
        this.mobileControls.attach();
        
        console.log("Mobile controls initialized", this.mobileControls);
        
        // Always increase visibility of mobile controls on touch devices
        const mobileControlsDiv = document.querySelector('.mobile-controls');
        if (mobileControlsDiv) {
            console.log("Enhancing mobile controls visibility");
            (mobileControlsDiv as HTMLElement).style.display = 'block';
            (mobileControlsDiv as HTMLElement).style.visibility = 'visible';
            
            // Make sure joystick is visible with enhanced opacity
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
            
            // Make buttons more visible with higher opacity
            const buttons = document.querySelectorAll('.mobile-button');
            buttons.forEach((button) => {
                (button as HTMLElement).style.opacity = '0.8';
            });
        }
    }

    public init(): void {
        // Renderer setup
        document.body.appendChild(this.getDomElement());
        
        // Create the timer overlay
        this.createTimerOverlay();
        
        // Add fullscreen button for desktop users
        if (!this.isMobile) {
            this.addDesktopFullscreenButton();
        }
        
        // Register window resize handler in Game class (not in LevelRenderer)
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Ensure mobile controls are set up if on mobile or if touch is available
        if (this.isMobile && !this.mobileControls) {
            this.setupMobileControls();
        }

        // Check WebGL context and log status
        //this.mobileControls!.checkWebGLContext();
        
        // Make sure the screen transition overlay has the correct z-index
        // It should be above the 3D scene but below the mobile controls
        this.screenTransition.getElement().style.zIndex = '999';
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
        
        // Calculate elapsed time since last update
        const elapsedTime = currentTime - this.lastUpdateTime;
        this.accumulatedTime += elapsedTime;
        this.lastUpdateTime = currentTime;
        
        // Process as many fixed updates as needed to catch up
        let updated = false;
        while (this.accumulatedTime >= this.timestep) {
            // Consume one timestep's worth of accumulated time
            this.accumulatedTime -= this.timestep;
            
            // Increment level timer if running
            if (this.isLevelTimerRunning) {
                this.levelTimerTicks++;
                
                // Update timer display every 5 ticks (12 times per second at 60fps)
                if (this.levelTimerTicks % 5 === 0) {
                    this.updateTimerDisplay();
                }
            }
            
            // Collect inputs to pass to level
            const inputs = this.collectInputs();
            
            // Execute the fixed update with inputs
            if(this.doLevelUpdate)
            {
                this.level!.fixedUpdate(inputs);
            }
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
        // Get forward vector from the camera
        const playerForward = this.levelRenderer!.camera.getForwardVector();
        
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
        container.id = 'fullscreen-controls-container'; // Add an ID for easier reference
        container.style.position = 'fixed';
        container.style.top = '10px';
        container.style.right = '10px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-end';
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
            <div>0,1,2 - Switch Levels</div>
        `;
        
        // Add elements to container
        container.appendChild(fullscreenBtn);
        container.appendChild(controlsHint);
        
        // Add click event to toggle fullscreen and pointer lock
        fullscreenBtn.addEventListener('click', () => {
            const docEl = document.documentElement;
            
            if (!document.fullscreenElement) {
                // Check if we need to show iOS prompt instead
                const customWindow = window as CustomWindow;
                if (customWindow.showIOSFullscreenPrompt && customWindow.showIOSFullscreenPrompt()) {
                    // iOS prompt will be shown, don't try to enter fullscreen
                    return;
                }
                
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
            // Get fresh reference to container each time
            const controlsContainer = document.getElementById('fullscreen-controls-container');
            if (!controlsContainer) return;

            if (document.fullscreenElement) {
                controlsContainer.style.display = 'none';
            } else {
                controlsContainer.style.display = 'flex';
                
                // Reset the controls hint to semi-transparent state
                const controlsHint = controlsContainer.querySelector('.controls-hint') as HTMLElement;
                if (controlsHint) {
                    controlsHint.style.opacity = '0.3';
                }
            }
        });
        
        // Add hover effect to show/hide controls hint
        container.addEventListener('mouseenter', () => {
            const controlsHint = container.querySelector('.controls-hint') as HTMLElement;
            if (controlsHint) {
                controlsHint.style.opacity = '1';
            }
        });
        
        container.addEventListener('mouseleave', () => {
            if (!document.fullscreenElement) {
                const controlsHint = container.querySelector('.controls-hint') as HTMLElement;
                if (controlsHint) {
                    controlsHint.style.opacity = '0.3';
                }
            }
        });
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
        console.log(`Starting switch to level ${levelIndex}`);
        
        // Stop current level timer
        this.stopLevelTimer();
        
        // Save current fullscreen and pointer lock state
        const wasInFullscreen = !!document.fullscreenElement;
        const wasPointerLocked = !!document.pointerLockElement;
        
        // Make sure the transition overlay doesn't interfere with pointer
        this.screenTransition.getElement().style.pointerEvents = 'none';
        
        // Start transition animation and execute level change when transition completes
        this.screenTransition.transitionInStart(() => {
            // This code runs when transition is complete
            this.doLevelSwitch(levelIndex);
            
            // After level switch is complete, restore fullscreen pointer lock if needed
            if (wasInFullscreen && wasPointerLocked) {
                // Wait a short moment for the new canvas to be ready
                setTimeout(() => {
                    if (document.fullscreenElement && !document.pointerLockElement) {
                        this.getDomElement().requestPointerLock();
                    }
                }, 100);
            }
        });
    }
    
    /**
     * Perform the actual level switch after transition effect
     * @param levelIndex The index of the level to switch to
     */
    private doLevelSwitch(levelIndex: number): void {
        console.log(`Switching to level ${levelIndex}...`);
        
        // Determine if we're switching to/from overworld
        const wasInOverworld = this.level?.levelIdx === 0;
        const goingToOverworld = levelIndex === 0;
        
        // Handle network room switching if needed
        if (this.network!.playerId && wasInOverworld !== goingToOverworld) {
            // We're changing between overworld and gameplay rooms
            if (goingToOverworld) {
                console.log("Switching to overworld room...");
                this.switchToOverworldRoom();
            } else {
                console.log("Switching to gameplay room...");
                this.switchToGameplayRoom();
            }
        }
        
        // Create new Level instance
        this.level = new Level(this, levelIndex);
        
        if (this.levelRenderer) {
            this.levelRenderer.reset(this.level);
            this.level.levelRenderer = this.levelRenderer;
        } else {
            this.levelRenderer = new LevelRenderer(this.level, this.highPerformanceMode);
            this.level.levelRenderer = this.levelRenderer;
            document.body.appendChild(this.levelRenderer.renderer.domElement);
        }
        
        // Add player and load content
        if (this.localPlayerId) {
            this.level.addPlayer(this.localPlayerId, true, this.userName);
        } else {
            const localId = `local-${Date.now()}`;
            this.level.addPlayer(localId, true, this.userName);
            this.localPlayerId = localId;
        }

        this.loadLevelContent(levelIndex);
        
        this.level.localPlayer?.setPosition(this.level.playerStartPosition);
        console.log(`Level ${levelIndex} switch complete`);
        
        // After level setup, reset and start timer for non-overworld levels
        if (levelIndex !== 0) {
            this.startLevelTimer();
        }
    }

    /**
     * Switch to the overworld room for multiplayer
     */
    private switchToOverworldRoom(): void {
        if (!this.network) return;
        
        // First disconnect from current room (likely gameplay)
        this.network.disconnect();
        
        // Connect to overworld room
        this.network.connectToRoom(RoomType.OVERWORLD)
            .then(networkId => {
                // Successfully connected to overworld
                console.log(`Connected to overworld with ID: ${networkId}`);
                
                // Update our ID if needed
                if (this.localPlayerId !== networkId) {
                    const oldId = this.localPlayerId;
                    this.localPlayerId = networkId;
                    
                    // If level exists and has the old player, change their ID
                    if (this.level && oldId) {
                        this.level.changePlayerId(oldId, networkId);
                    }
                }
            })
            .catch(error => {
                console.error("Failed to connect to overworld:", error);
            });
    }

    /**
     * Switch to the gameplay room for non-overworld levels
     */
    private switchToGameplayRoom(): void {
        if (!this.network) return;
        
        // First disconnect from current room (likely overworld)
        this.network.disconnect();
        
        // Connect to gameplay room
        this.network.connectToRoom(RoomType.GAMEPLAY)
            .then(networkId => {
                // Successfully connected to gameplay room
                console.log(`Connected to gameplay room with ID: ${networkId}`);
                
                // Update our ID if needed
                if (this.localPlayerId !== networkId) {
                    const oldId = this.localPlayerId;
                    this.localPlayerId = networkId;
                    
                    // If level exists and has the old player, change their ID
                    if (this.level && oldId) {
                        this.level.changePlayerId(oldId, networkId);
                    }
                }
            })
            .catch(error => {
                console.error("Failed to connect to gameplay room:", error);
            });
    }

    // New method to ensure level content is loaded before player creation
    private loadLevelContent(levelIndex: number): void {
        console.log(`Loading level content for level ${levelIndex}...`);
        
        // Reset and start the level timer (except for overworld)
        if (levelIndex !== 0) {
            this.startLevelTimer();
        } else {
            this.stopLevelTimer(); // Stop timer in overworld
        }
        
        // Load the appropriate level content
        switch (levelIndex) {
            case 0:
                TestLevels.createOverworld(this.level!, this);
                break;
            case 1:
                TestLevels.createJungleGymTest(this.level!, this);
                break;
            case 2:
                TestLevels.createSkydivingChallenge(this.level!, this);
                break;
            case 3:
                BeginnerLevels.createTutorialLevel(this.level!, this);
                break;
            case 4:
                loadJSONLevel(this.level!, this, tutorial_level);
                break;
            default:
                console.error(`Unknown level index: ${levelIndex}`);
                TestLevels.createOverworld(this.level!, this);
        }
        
        console.log("Level content loaded successfully");
    }

    // Make sure to clean up on destroy
    public destroy(): void {
        // Remove the timer element if it exists
        if (this.timerElement && this.timerElement.parentNode) {
            this.timerElement.parentNode.removeChild(this.timerElement);
            this.timerElement = null;
        }
        
        // Clean up other event listeners and resources
        this.screenTransition.destroy();
    }

    /**
     * Check for portal parameters in the URL and handle them
     */
    private checkPortalParameters(): void {
        const urlParams = new URLSearchParams(window.location.search);
        this.isFromPortal = urlParams.get('portal') === 'true';
        
        if (this.isFromPortal) {
            console.log("Player has arrived via a portal!");
            
            // Store all URL parameters for potential return journey
            urlParams.forEach((value, key) => {
                this.portalParams[key] = value;
            });
            
            // Store referrer URL separately for quick access
            this.fromPortalRef = urlParams.get('ref');
            
            // Extract common player parameters for logging
            const username = urlParams.get('username');
            const color = urlParams.get('color');
            const speed = urlParams.get('speed');
            const team = urlParams.get('team');
            
            // Additional parameters
            const avatarUrl = urlParams.get('avatar_url');
            const speedX = urlParams.get('speed_x');
            const speedY = urlParams.get('speed_y');
            const speedZ = urlParams.get('speed_z');
            const rotationX = urlParams.get('rotation_x');
            const rotationY = urlParams.get('rotation_y');
            const rotationZ = urlParams.get('rotation_z');
            
            // Log the incoming player information
            console.log(`Portal player: ${username || 'unknown'}, from: ${this.fromPortalRef || 'unknown'}`);
            console.log(`Player properties: color=${color}, speed=${speed}, team=${team || 'none'}`);
            console.log(`Additional properties: speed_xyz=[${speedX || '0'},${speedY || '0'},${speedZ || '0'}], rotation_xyz=[${rotationX || '0'},${rotationY || '0'},${rotationZ || '0'}]`);
        } else {
            // Clear portal parameters if not from portal
            this.portalParams = {};
            this.fromPortalRef = null;
        }
    }

    /**
     * Check if the player arrived via a portal
     * @returns True if the player came from a portal
     */
    public isPlayerFromPortal(): boolean {
        return this.isFromPortal;
    }
    
    /**
     * Get the referrer URL that the player came from
     * @returns The referrer URL or null if not from portal
     */
    public getPortalReferrer(): string | null {
        return this.fromPortalRef;
    }
    
    /**
     * Get a specific portal parameter
     * @param key The parameter key to get
     * @returns The parameter value or null if not found
     */
    public getPortalParameter(key: string): string | null {
        return this.portalParams[key] || null;
    }
    
    /**
     * Get all portal parameters
     * @returns All portal parameters
     */
    public getAllPortalParameters(): {[key: string]: string} {
        return {...this.portalParams}; // Return a copy to prevent modification
    }
    
    /**
     * Build a return URL to the portal referrer with all original parameters
     * @returns URL to return to the original portal
     */
    public buildPortalReturnUrl(): string | null {
        if (!this.fromPortalRef) {
            return null;
        }
        
        // Start with the referrer URL
        let url = this.fromPortalRef;
        
        // Add parameters (except 'ref' to avoid circular references)
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(this.portalParams)) {
            if (key !== 'ref') {
                params.append(key, value);
            }
        }
        
        // Add portal=true parameter to indicate this is a portal return
        params.append('portal', 'true');
        
        // Add our URL as the new referrer
        params.append('ref', window.location.href);
        
        // Combine URL and parameters
        if (url.includes('?')) {
            // URL already has parameters
            url += '&' + params.toString();
        } else {
            // URL has no parameters yet
            url += '?' + params.toString();
        }
        
        return url;
    }

    /**
     * Trigger a screen transition and then redirect to a URL
     * @param url The URL to navigate to after the transition effect
     */
    public transitionToPortal(url: string): void {
        console.log(`Starting portal transition to: ${url}`);
        
        // Start the transition animation and execute the URL redirect when the transition completes
        this.screenTransition.transitionInStart(() => {
            // This code runs when transition is complete
            console.log(`Portal transition complete, redirecting to: ${url}`);
            window.location.href = url;
        });
    }
    
    /**
     * Trigger a halfway screen transition (filling the screen) and then redirect to an external URL
     * Used for external portals like Vibeverse that go to different domains
     * @param url The URL to navigate to after the transition effect
     */
    public transitionToExternalPortal(url: string): void {
        console.log(`Starting external portal transition to: ${url}`);
        
        window.location.href = url;
        // Use the halfway transition that only fills the screen with bubbles but doesn't clear them
        this.screenTransition.transitionHalfwayStart(() => {
            // This code runs when transition is complete (screen is filled)
            console.log(`External portal transition complete, redirecting to: ${url}`);
        });
    }

    /**
     * Attempt to connect to the server in the background without blocking gameplay
     */
    private connectInBackground(): void {
        console.log("Attempting to connect to server in background...");
        
        // Connect to the appropriate room based on current level
        const initialRoom = this.level?.levelIdx === 0 ? 
            RoomType.OVERWORLD : RoomType.GAMEPLAY;
        
        // Try to connect but don't block the game
        this.network!.connectToRoom(initialRoom).then((networkId) => {
            // Connection successful, update the local player's ID
            if (this.level && this.localPlayerId) {
                const success = this.level.changePlayerId(this.localPlayerId, networkId);
                if (success) {
                    // Update our stored local player ID
                    this.localPlayerId = networkId;
                    console.log(`Seamlessly transitioned to multiplayer mode with ID: ${networkId} and username: ${this.userName}`);
                    
                    // Make sure the player's username is set correctly after ID change
                    const player = this.level.getPlayer(networkId);
                    if (player) {
                        player.username = this.userName;
                    }
                } else {
                    console.error("Failed to update player ID for multiplayer");
                }
            }
        }).catch((error) => {
            // Connection failed, but game is already running in single-player mode
            console.log("Couldn't connect to server, continuing in single-player mode", error);
        });
    }

    /**
     * Generate a fun random username by combining prefixes, nouns, and suffixes
     */
    private generateRandomUsername(): string {
        // Fun prefixes
        const prefixes = [
            "Epic", "Super", "Mega", "Ultra", "Hyper", "Awesome", "Rad", "Cool", "Swift", "Speedy",
            "Flying", "Jumping", "Crazy", "Funky", "Groovy", "Wild", "Mighty", "Brave", "Sneaky",
            "Ninja", "Pixel", "Cyber", "Digital", "Quantum", "Cosmic", "Astro", "Turbo", "Power"
        ];
        
        // Nouns/creatures
        const nouns = [
            "Panda", "Tiger", "Eagle", "Shark", "Wolf", "Dragon", "Phoenix", "Unicorn", "Wizard", 
            "Warrior", "Runner", "Jumper", "Rider", "Racer", "Hunter", "Explorer", "Adventurer",
            "Robot", "Cyborg", "Ninja", "Pirate", "Knight", "Samurai", "Hero", "Legend", "Ghost",
            "Monkey", "Fox", "Lion", "Dolphin", "Penguin", "Koala", "Sloth", "Rhino", "Hedgehog"
        ];
        
        // Optional suffixes or numbers
        const suffixes = [
            "", "", "", "", "", // Empty strings increase chance of no suffix
            "Master", "King", "Queen", "Pro", "Star", "Champion", "Expert", "Guru", "Genius",
            "X", "Z", "Prime", "Alpha", "Omega", "Plus", "Max", "Ultra"
        ];
        
        // Random number suffix (0-999)
        const numbers = ["", "", ""]; // Empty strings increase chance of no number
        for (let i = 0; i < 50; i++) {
            numbers.push(Math.floor(Math.random() * 1000).toString());
        }
        
        // Randomly decide to use a prefix
        let username = "";
        if (Math.random() > 0.3) { // 70% chance to have prefix
            username += prefixes[Math.floor(Math.random() * prefixes.length)];
        }
        
        // Always have a noun
        if (username.length > 0) {
            username += nouns[Math.floor(Math.random() * nouns.length)];
        } else {
            // Capitalize the noun if it's the first word
            const noun = nouns[Math.floor(Math.random() * nouns.length)];
            username += noun.charAt(0).toUpperCase() + noun.slice(1);
        }
        
        // Add a suffix (lower chance)
        if (Math.random() > 0.7) { // 30% chance to have suffix
            username += suffixes[Math.floor(Math.random() * suffixes.length)];
        }
        
        // Add a number (lower chance)
        if (Math.random() > 0.6) { // 40% chance to have number
            username += numbers[Math.floor(Math.random() * numbers.length)];
        }
        
        return username;
    }

    /**
     * Show a dialog prompting the user to enter a username
     */
    private showUsernamePrompt(): void {
        // Create the modal container
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '10000';
        
        // Create the modal content
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = '#333';
        modalContent.style.color = 'white';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '8px';
        modalContent.style.maxWidth = '400px';
        modalContent.style.width = '90%';
        modalContent.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        modalContent.style.textAlign = 'center';
        modalContent.style.fontFamily = 'Arial, sans-serif';
        
        // Add title
        const title = document.createElement('h2');
        title.textContent = 'Choose Your Username';
        title.style.margin = '0 0 20px 0';
        title.style.color = '#fff';
        
        // Add current random username as placeholder
        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.placeholder = this.userName;
        usernameInput.value = this.userName;
        usernameInput.style.width = '100%';
        usernameInput.style.padding = '10px';
        usernameInput.style.marginBottom = '20px';
        usernameInput.style.borderRadius = '4px';
        usernameInput.style.border = 'none';
        usernameInput.style.backgroundColor = '#555';
        usernameInput.style.color = '#fff';
        usernameInput.style.fontSize = '16px';
        usernameInput.style.boxSizing = 'border-box';
        
        // Add random name generator button
        const randomBtn = document.createElement('button');
        randomBtn.textContent = 'Random Name';
        randomBtn.style.padding = '10px 15px';
        randomBtn.style.margin = '0 10px 20px 10px';
        randomBtn.style.border = 'none';
        randomBtn.style.borderRadius = '4px';
        randomBtn.style.backgroundColor = '#555';
        randomBtn.style.color = '#fff';
        randomBtn.style.cursor = 'pointer';
        randomBtn.style.fontSize = '14px';
        
        // Add save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Username';
        saveBtn.style.padding = '10px 15px';
        saveBtn.style.margin = '0 10px 20px 10px';
        saveBtn.style.border = 'none';
        saveBtn.style.borderRadius = '4px';
        saveBtn.style.backgroundColor = '#4CAF50';
        saveBtn.style.color = 'white';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.fontSize = '14px';
        
        // Add note
        const note = document.createElement('p');
        note.textContent = 'This username will be used in multiplayer. You can change it later by pressing P.';
        note.style.fontSize = '12px';
        note.style.color = '#aaa';
        note.style.margin = '0';
        
        // Add event listeners
        randomBtn.addEventListener('click', () => {
            const newRandomName = this.generateRandomUsername();
            usernameInput.value = newRandomName;
            usernameInput.focus();
        });
        
        saveBtn.addEventListener('click', () => {
            const newUsername = usernameInput.value.trim();
            if (newUsername && newUsername.length >= 3) {
                // Save to localStorage
                localStorage.setItem('username', newUsername);
                
                // Update username in game
                this.changeUsername(newUsername);
                
                // Remove modal
                document.body.removeChild(modal);
            } else {
                // Show error if username is too short
                usernameInput.style.border = '2px solid #ff6347';
                setTimeout(() => {
                    usernameInput.style.border = 'none';
                }, 1000);
            }
        });
        
        // Keyboard event to save on Enter
        usernameInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                saveBtn.click();
            }
        });
        
        // Add all elements to modal content
        modalContent.appendChild(title);
        modalContent.appendChild(usernameInput);
        const buttonContainer = document.createElement('div');
        buttonContainer.appendChild(randomBtn);
        buttonContainer.appendChild(saveBtn);
        modalContent.appendChild(buttonContainer);
        modalContent.appendChild(note);
        
        // Add modal content to modal
        modal.appendChild(modalContent);
        
        // Add modal to body
        document.body.appendChild(modal);
        
        // Focus the input
        setTimeout(() => {
            usernameInput.focus();
            usernameInput.select(); // Select all text
        }, 100);
    }

    /**
     * Change the player's username
     * @param newUsername The new username to set
     */
    public changeUsername(newUsername: string): void {
        // Don't change if it's the same
        if (this.userName === newUsername) return;
        
        const oldUsername = this.userName;
        this.userName = newUsername;
        console.log(`Username changed from "${oldUsername}" to "${newUsername}"`);
        
        // Save to localStorage
        localStorage.setItem('username', newUsername);
        
        // Update the player object's username
        if (this.level && this.localPlayerId) {
            const localPlayer = this.level.getPlayer(this.localPlayerId);
            if (localPlayer) {
                localPlayer.username = newUsername;
                // If the player is in a scene, update the username text
                if (this.levelRenderer?.scene) {
                    localPlayer.updateUsernameText(this.levelRenderer.scene);
                }
            }
        }
        
        // Send update to server if connected
        if (this.network && this.network.playerId) {
            this.network.sendUsernameChange(newUsername);
        }
    }

    /**
     * Report level completion to server
     * @param levelId The level ID that was completed
     * @param timeMs Time taken to complete the level in milliseconds
     * @param stars Number of stars earned (optional)
     */
    public reportLevelCompletion(levelId: number, timeMs: number, stars: number = 0): void {
        console.log(`Level ${levelId} completed in ${timeMs}ms with ${stars} stars`);
        
        // Send to server if connected
        if (this.network && this.network.playerId) {
            this.network.sendLevelCompletion(levelId, timeMs, stars);
        }
    }

    /**
     * Simple update method for editor mode (no physics, just rendering)
     */
    // private updateEditor(): void {
    //     const currentTime = performance.now();
    //     const deltaTime = currentTime - this.lastUpdateTime;
    //     this.lastUpdateTime = currentTime;
        
    //     // Update camera - this will now handle the first-person flying motion
    //     if (this.levelRenderer) {
    //         this.levelRenderer.camera.update();
    //         this.levelRenderer.render();
    //     }
        
    //     // Continue the editor loop
    //     requestAnimationFrame(this.updateEditor.bind(this));
    // }
   
    public timedLevelFinished(): void {
        if (this.isLevelTimerRunning) {
            // Stop the timer
            this.isLevelTimerRunning = false;
            
            // Calculate time in seconds
            const timeInSeconds = this.levelTimerTicks / this.ticksPerSecond;
            
            // Log the results
            console.log(`Level ${this.level?.levelIdx} completed!`);
            console.log(`Time: ${this.levelTimerTicks} ticks (${timeInSeconds.toFixed(2)} seconds)`);
            
            // Report to server if needed
            if (this.level) {
                this.reportLevelCompletion(this.level.levelIdx, this.levelTimerTicks * (1000 / this.ticksPerSecond));
            }
            
            // Show completion message with time
            this.showLevelCompletedMessage(timeInSeconds);
        }
    }

    // Add this method:
    private handleCameraMovementKey(key: string, isDown: boolean): void {
        if (!this.levelRenderer) return;
        
        // Update the specific key state
        this.inputKeys[key.toLowerCase()] = isDown;
        
        // Get current key states
        const forward = this.inputKeys['w'] || false;
        const backward = this.inputKeys['s'] || false;
        const left = this.inputKeys['a'] || false;
        const right = this.inputKeys['d'] || false;
        
        // Use space for up and shift for down (Minecraft style)
        const up = this.inputKeys[' '] || false;  // Space key
        const down = this.inputKeys['shift'] || false;
        
        // Use left control or left alt as sprint modifier
        const sprint = this.inputKeys['control'] || this.inputKeys['alt'] || false;
        
        // Update camera movement state with all current keys
        this.levelRenderer.camera.updateMovementState(
            forward, backward, left, right, up, down
        );
    }

    // Add new methods for timer functionality
    public startLevelTimer(): void {
        this.levelTimerTicks = 0;
        this.isLevelTimerRunning = true;
        console.log("Level timer started");
        
        // Update and show the timer display
        this.updateTimerDisplay();
        if (this.timerElement) {
            this.timerElement.style.opacity = '0.8';
        }
    }
    
    public stopLevelTimer(): void {
        this.isLevelTimerRunning = false;
        
        // Hide the timer
        if (this.timerElement) {
            this.timerElement.style.opacity = '0';
        }
    }
    
    // Add new method to update the timer display
    private updateTimerDisplay(): void {
        if (!this.timerElement) return;
        
        // Convert ticks to seconds and format as MM:SS.mm
        const totalSeconds = this.levelTimerTicks / this.ticksPerSecond;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const milliseconds = Math.floor((totalSeconds % 1) * 100);
        
        // Format the time string
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
        
        // Update the timer text
        this.timerElement.textContent = `Time: ${timeString}`;
    }
    
    // Add method to show level completed message
    private showLevelCompletedMessage(timeInSeconds: number): void {
        // Format the time string
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        const milliseconds = Math.floor((timeInSeconds % 1) * 100);
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
        
        // Create level complete element
        const completeElement = document.createElement('div');
        
        // Style the completion message
        Object.assign(completeElement.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#ffff00', // Bright yellow
            padding: '20px',
            borderRadius: '10px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            textAlign: 'center',
            zIndex: '1001',
            boxShadow: '0 0 20px rgba(255, 255, 0, 0.5)',
            animation: 'fadeInOut 4s forwards'
        });
        
        // Add CSS animation
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes fadeInOut {
                0% { opacity: 0; }
                20% { opacity: 1; }
                80% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        // Set the message content
        completeElement.textContent = `Level Complete! Final Time: ${timeString}`;
        
        // Add to document
        document.body.appendChild(completeElement);
        
        // Remove after animation completes
        setTimeout(() => {
            document.body.removeChild(completeElement);
            document.head.removeChild(style);
        }, 4000);
    }
} 
