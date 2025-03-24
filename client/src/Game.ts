import * as THREE from 'three';
import { MobileControls } from './MobileControls';
import { TestLevels } from './TestLevels';
import { Level } from './Level';
import { LevelRenderer } from './LevelRenderer';
import { ScreenTransition } from './ScreenTransition';

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
    
    // Add debug mode flag
    private debugMode: boolean = false;

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

    constructor() {
        // Add error logger first thing
        this.setupErrorLogger();
        
        // Detect device capabilities first
        this.detectDeviceCapabilities();
        
        // Always use high performance mode for now (can be adjusted based on detection)
        this.highPerformanceMode = true;
        
        // Check for portal parameters (do this before creating level)
        this.checkPortalParameters();
        
        // Create Level and LevelRenderer with predetermined performance mode
        try {
            this.level = new Level(this, 0);
            this.levelRenderer = new LevelRenderer(this.level, this.highPerformanceMode);
            this.level.levelRenderer = this.levelRenderer;
            
            // Initialize after renderer is set up
            this.init();
            
            // Load the default level (now the overworld)
            this.switchLevel(0);
            
            // Setup controls - always set up mobile controls for touch devices
            this.setupControls();
            
            // Start the game loop
            this.lastUpdateTime = performance.now();
            requestAnimationFrame(this.update.bind(this));
        } catch (error: any) {
            this.logError("Game initialization error: " + error.message);
            console.error("Game initialization error:", error);
        }
    }

    /**
     * Set up error logging to display on screen for mobile debugging
     */
    private setupErrorLogger(): void {
        // Create error display container
        const errorContainer = document.createElement('div');
        errorContainer.id = 'error-logger';
        errorContainer.style.position = 'fixed';
        errorContainer.style.top = '0';
        errorContainer.style.left = '0';
        errorContainer.style.width = '100%';
        errorContainer.style.padding = '10px';
        errorContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        errorContainer.style.color = 'red';
        errorContainer.style.fontFamily = 'monospace';
        errorContainer.style.fontSize = '12px';
        errorContainer.style.zIndex = '10000';
        errorContainer.style.overflowY = 'auto';
        errorContainer.style.maxHeight = '50%';
        errorContainer.style.display = 'none'; // Hidden by default
        
        // Add a clear button
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear';
        clearButton.style.position = 'absolute';
        clearButton.style.right = '10px';
        clearButton.style.top = '10px';
        clearButton.style.zIndex = '10001';
        clearButton.addEventListener('click', () => {
            const logContainer = document.getElementById('error-log-content');
            if (logContainer) logContainer.innerHTML = '';
        });
        errorContainer.appendChild(clearButton);
        
        // Add a content div for logs
        const logContent = document.createElement('div');
        logContent.id = 'error-log-content';
        errorContainer.appendChild(logContent);
        
        // Add show/hide toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'toggle-error-log';
        toggleButton.textContent = 'Show Logs';
        toggleButton.style.position = 'fixed';
        toggleButton.style.top = '10px';
        toggleButton.style.left = '10px';
        toggleButton.style.zIndex = '10001';
        toggleButton.style.padding = '5px';
        toggleButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        toggleButton.style.color = 'white';
        toggleButton.style.border = '1px solid red';
        toggleButton.style.borderRadius = '5px';
        // Initially hide the toggle button unless in debug mode
        toggleButton.style.display = this.debugMode ? 'block' : 'none';
        
        toggleButton.addEventListener('click', () => {
            if (errorContainer.style.display === 'none') {
                errorContainer.style.display = 'block';
                toggleButton.textContent = 'Hide Logs';
            } else {
                errorContainer.style.display = 'none';
                toggleButton.textContent = 'Show Logs';
            }
        });
        
        // Add elements to the DOM
        document.body.appendChild(errorContainer);
        document.body.appendChild(toggleButton);
        
        // Override console.log and console.error
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        
        console.log = (...args) => {
            this.logMessage(args.map(arg => this.formatArg(arg)).join(' '));
            originalConsoleLog.apply(console, args);
        };
        
        console.error = (...args) => {
            this.logError(args.map(arg => this.formatArg(arg)).join(' '));
            originalConsoleError.apply(console, args);
        };
        
        // Add global error handler
        window.addEventListener('error', (event) => {
            this.logError(`ERROR: ${event.message} at ${event.filename}:${event.lineno}`);
            return false;
        });
        
        // Add unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.logError(`Unhandled Promise Rejection: ${event.reason}`);
        });
        
        // Add keyboard shortcut to show/hide logs (Ctrl+D)
        window.addEventListener('keydown', (event) => {
            if (event.ctrlKey && (event.key === 'd' || event.key === 'D')) {
                event.preventDefault(); // Prevent browser bookmark dialog
                const toggleBtn = document.getElementById('toggle-error-log');
                if (toggleBtn) {
                    toggleBtn.style.display = toggleBtn.style.display === 'none' ? 'block' : 'none';
                    
                    // If showing the toggle, also update debug mode
                    if (toggleBtn.style.display === 'block') {
                        this.debugMode = true;
                    }
                }
            }
        });
    }
    
    /**
     * Format argument for logging
     */
    private formatArg(arg: any): string {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return arg.toString();
            }
        }
        return String(arg);
    }
    
    /**
     * Log a message to the on-screen display
     */
    private logMessage(message: string): void {
        const logContainer = document.getElementById('error-log-content');
        if (!logContainer) return;
        
        const logEntry = document.createElement('div');
        logEntry.textContent = message;
        logEntry.style.borderBottom = '1px solid #333';
        logEntry.style.padding = '5px 0';
        logEntry.style.color = 'white';
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Only show the toggle button in debug mode
        if (this.debugMode) {
            const toggleButton = document.getElementById('toggle-error-log');
            if (toggleButton) toggleButton.style.display = 'block';
        }
    }
    
    /**
     * Log an error to the on-screen display
     */
    private logError(message: string): void {
        const logContainer = document.getElementById('error-log-content');
        if (!logContainer) return;
        
        const logEntry = document.createElement('div');
        logEntry.textContent = message;
        logEntry.style.borderBottom = '1px solid #333';
        logEntry.style.padding = '5px 0';
        logEntry.style.color = 'red';
        logEntry.style.fontWeight = 'bold';
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Auto-show the error log only when in debug mode
        if (this.debugMode) {
            const errorContainer = document.getElementById('error-logger');
            if (errorContainer) errorContainer.style.display = 'block';
            
            // Update toggle button text
            const toggleButton = document.getElementById('toggle-error-log');
            if (toggleButton) {
                toggleButton.style.display = 'block';
                toggleButton.textContent = 'Hide Logs';
            }
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
     * Set up keyboard input tracking (only track state, don't update player here)
     */
    public setupControls(): void {
        // Mouse controls for camera rotation
        let domElement = this.getDomElement();
        
        // First, remove any existing keyboard listeners
        this.removeKeyListeners();
        
        // Set up keyboard input tracking
        this.inputKeys = {};
        
        // Create the event listeners and store references to them
        this.keydownListener = (event) => {
            this.inputKeys[event.key.toLowerCase()] = true;
            
            // Handle level switching separately (not in the listener)
            if (event.key === '0') {
                this.switchLevel(0); // Overworld
            } else if (event.key === '1') {
                this.switchLevel(1); // Jungle Gym
            } else if (event.key === '2') {
                this.switchLevel(2); // Simple Test
            }
        };
        
        this.keyupListener = (event) => {
            this.inputKeys[event.key.toLowerCase()] = false;
        };
        
        // Add the listeners
        window.addEventListener('keydown', this.keydownListener);
        window.addEventListener('keyup', this.keyupListener);
        
        // Mouse controls for camera rotation
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
    }

    // Method to remove key listeners
    private removeKeyListeners(): void {
        if (this.keydownListener) {
            window.removeEventListener('keydown', this.keydownListener);
            this.keydownListener = null;
        }
        
        if (this.keyupListener) {
            window.removeEventListener('keyup', this.keyupListener);
            this.keyupListener = null;
        }
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
        
        // Check WebGL context and log status
        this.checkWebGLContext();
        
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
        
        // Make sure the screen transition overlay has the correct z-index
        // It should be above the 3D scene but below the mobile controls
        this.screenTransition.getElement().style.zIndex = '999';
    }

    /**
     * Check if WebGL is supported and log detailed info about the context
     */
    private checkWebGLContext(): void {
        try {
            if (!this.levelRenderer || !this.levelRenderer.renderer) {
                this.logError("WebGL: Renderer not initialized");
                return;
            }
            
            const gl = this.levelRenderer.renderer.getContext();
            if (!gl) {
                this.logError("WebGL: Failed to get WebGL context");
                return;
            }
            
            // Log WebGL info
            this.logMessage(`WebGL Version: ${gl.getParameter(gl.VERSION)}`);
            this.logMessage(`WebGL Vendor: ${gl.getParameter(gl.VENDOR)}`);
            this.logMessage(`WebGL Renderer: ${gl.getParameter(gl.RENDERER)}`);
            this.logMessage(`Max Texture Size: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
            this.logMessage(`Max Viewport Dims: ${gl.getParameter(gl.MAX_VIEWPORT_DIMS)}`);
            
            // Check for lost context
            if (gl.isContextLost()) {
                this.logError("WebGL: Context is lost!");
            } else {
                this.logMessage("WebGL: Context is valid");
            }
            
            // Check canvas size
            const canvas = this.levelRenderer.renderer.domElement;
            this.logMessage(`Canvas size: ${canvas.width}x${canvas.height}`);
            this.logMessage(`Canvas display size: ${canvas.clientWidth}x${canvas.clientHeight}`);
            
            // Check if the renderer has actually rendered anything
            this.logMessage(`Renderer info - Render calls: ${this.levelRenderer.renderer.info.render.calls}`);
            this.logMessage(`Renderer info - Triangles: ${this.levelRenderer.renderer.info.render.triangles}`);
        } catch (error: any) {
            this.logError(`WebGL check error: ${error.message}`);
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
        
        // Remove keyboard event listeners to prevent duplicates
        this.removeKeyListeners();
        
        // Create new Level instance
        this.level = new Level(this, levelIndex);
        
        // If renderer exists, just reset it with the new level
        if (this.levelRenderer) {
            // Simply reset the renderer with new level - keeps WebGL context
            this.levelRenderer.reset(this.level);
            
            // Update level's reference to this renderer
            this.level.levelRenderer = this.levelRenderer;
        } else {
            // First time - create new renderer
            this.levelRenderer = new LevelRenderer(this.level, this.highPerformanceMode);
            this.level.levelRenderer = this.levelRenderer;
            
            // Add the renderer's canvas to the DOM
            document.body.appendChild(this.levelRenderer.renderer.domElement);
        }

        // Create a player
        const player = this.level.addPlayer('local', true);
        
        // Load the appropriate level
        switch (levelIndex) {
            case 0:
                TestLevels.createOverworld(this.level, this);
                break;
            case 1:
                TestLevels.createJungleGymTest(this.level, this);
                break;
            case 2:
                TestLevels.createSkydivingChallenge(this.level, this);
                break;
            default:
                console.error(`Unknown level index: ${levelIndex}`);
                TestLevels.createOverworld(this.level, this);
        }
        
        // Re-initialize controls
        this.setupControls();
        
        console.log(`Level ${levelIndex} switch complete`);
    }

    // Make sure to clean up on destroy
    public destroy(): void {
        this.removeKeyListeners();
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
        
        // Use the halfway transition that only fills the screen with bubbles but doesn't clear them
        this.screenTransition.transitionHalfwayStart(() => {
            // This code runs when transition is complete (screen is filled)
            console.log(`External portal transition complete, redirecting to: ${url}`);
            window.location.href = url;
        });
    }
} 
