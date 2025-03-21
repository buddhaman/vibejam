import * as THREE from 'three';
import { Player } from './Player';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { StaticBody } from './StaticBody';
import { InstancedRenderer } from './Render';
import { RigidBody } from './RigidBody';
import { Rope } from './Rope';
import { MobileControls } from './MobileControls';
import { Saw } from './Saw';
import { ParticleSystem } from './ParticleSystem';

export class Game {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public composer!: EffectComposer;
    public players: Map<string, Player>;
    public localPlayer: Player | null;
    public cameraDistance: number = 8;
    public cameraTheta: number = 0; // Horizontal angle
    public cameraPhi: number = Math.PI / 3; // Vertical angle (0 to PI)
    public cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
    public isDragging: boolean = false;
    public previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };
    public toonShadowsEnabled: boolean = false;
    public toonTextureGradient: THREE.Texture | null = null;
    
    // Static bodies collection for collision detection
    public staticBodies: StaticBody[] = [];
    
    // Dynamic bodies collection (similar to static bodies)
    public dynamicBodies: RigidBody[] = [];

    // Add fixed framerate properties
    public targetFPS: number = 60;
    public timestep: number = 1000 / this.targetFPS; // Fixed timestep in milliseconds (60 FPS)
    public lastUpdateTime: number = 0;
    public accumulatedTime: number = 0;

    // Add this property to the Game class
    public inputKeys: { [key: string]: boolean } = {};

    // Add high performance mode toggle
    private highPerformanceMode: boolean = true;
    
    // Add this property to the Game class
    private instancedRenderer: InstancedRenderer;
    private testTime: number = 0;

    // Add rope collection to Game class
    public ropes: Rope[] = [];

    // Add mobile controls
    private mobileControls: MobileControls | null = null;
    private isMobile: boolean = false;

    // Saw blades collection
    public saws: Saw[] = [];

    // Add particle system
    private particleSystem: ParticleSystem;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Configure renderer with performance detection
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Detect mobile devices and set performance mode accordingly
        this.detectDeviceCapabilities();
        
        // Initialize mobile controls immediately if on mobile device
        if (this.isMobile) {
            this.setupMobileControls();
        }
        
        // Initialize players first
        this.players = new Map();
        this.localPlayer = null;
        
        // Initialize AFTER renderer is set up
        this.init();
        
        // Initialize composer only in high performance mode
        if (this.highPerformanceMode) {
            this.initComposer();
            this.setupSimpleCellShading();
        }
        
        // Add a single test box for collision
        this.createTestBox();

        // Initialize the instanced renderer
        this.instancedRenderer = new InstancedRenderer(this.scene);
        
        // Create dynamic platforms
        this.createDynamicPlatforms();
        
        // Create saws
        this.createSaws();
        
        // Create test ropes
        this.createTestRopes();

        // Initialize particle system
        this.particleSystem = new ParticleSystem(this.instancedRenderer);
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
        
        // Apply appropriate renderer settings
        if (!this.highPerformanceMode) {
            this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
            this.renderer.shadowMap.enabled = false;
        } else {
            // For high performance mode, enable shadows and toon shading by default
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowMap;
            this.toonShadowsEnabled = true;
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
        
        // Apply appropriate settings
        if (highPerformance) {
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowMap;
            
            // Initialize composer for the rendering pipeline
            if (!this.composer) {
                this.initComposer();
            }
            
            // Setup cell shading and turn on toon shadows by default
            this.setupSimpleCellShading();
            
            // Recreate all lights for high performance mode
            this.setupLighting();
        } else {
            this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
            this.renderer.shadowMap.enabled = false;
            this.toonShadowsEnabled = false;
            
            // Recreate simple lighting for low performance mode
            this.setupLighting();
        }
        
        console.log(`Switched to ${highPerformance ? 'high' : 'low'} performance mode`);
    }

    /**
     * Add a static body to the game
     * @param body The static body to add
     * @returns The added static body
     */
    public addStaticBody(body: StaticBody): StaticBody {
        this.staticBodies.push(body);
        this.scene.add(body.mesh);

        // If toon shadows are enabled, ensure the body has proper material
        if (this.toonShadowsEnabled && this.toonTextureGradient) {
            this.applyToonMaterial(body.mesh);
        }

        return body;
    }
    
    /**
     * Apply toon material to a mesh
     */
    public applyToonMaterial(mesh: THREE.Mesh): void {
        if (!(mesh.material instanceof THREE.MeshToonMaterial) && 
            !(mesh.material instanceof THREE.LineBasicMaterial)) {
            
            // Extract color from original material
            let color = new THREE.Color(0xffffff);
            if (mesh.material.hasOwnProperty('color')) {
                color = (mesh.material as any).color;
            }
            
            // Create toon material
            const toonMaterial = new THREE.MeshToonMaterial({
                color: color,
                gradientMap: this.toonTextureGradient || undefined
            });
            
            // Replace material
            mesh.material = toonMaterial;
        }
    }

    /**
     * Create a test box for collision detection
     */
    public createTestBox(): void {
        // Create various materials for different structures with more distinct colors
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4a5bd, // Base pink color for the floor
            roughness: 0.8,
            metalness: 0.2
        });
        
        // Use a darker reddish color for platforms that's still bright
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0xff4b81, // Brighter, more saturated pink
            roughness: 0.3,
            metalness: 0.4,
            emissive: 0xff4b81, // Same as color for a natural glow
            emissiveIntensity: 0.3 // Adjust as needed
        });
        
        const obstacleMaterial = new THREE.MeshStandardMaterial({
            color: 0x8a2be2, // Brighter purple for obstacles
            roughness: 0.5,
            metalness: 0.5
        });

        // STARTING AREA
        // =============
        // Starting platform at y=2 with stairs
        this.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-15, 0, -15),
            new THREE.Vector3(15, 2, 15),
            platformMaterial,
            "starting-platform"
        ));
        
        // Staircase down from starting platform (4 steps)
        for (let i = 0; i < 4; i++) {
            this.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(15 + i*2, 0, -4),
                new THREE.Vector3(17 + i*2, 2 - i*0.5, 4),
                platformMaterial,
                `stair-${i}`
            ));
        }
        
        // OBSTACLE COURSE
        // ==============
        
        // Create a series of platforms with increasing gaps
        const platformCount = 5;
        let lastX = 25;
        
        for (let i = 0; i < platformCount; i++) {
            const platformSize = 4 - i * 0.5; // Platforms get smaller
            const gap = 3 + i * 0.7; // Gaps get larger
            
            this.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(lastX, 0, -platformSize),
                new THREE.Vector3(lastX + platformSize, 1, platformSize),
                platformMaterial,
                `jump-platform-${i}`
            ));
            
            lastX += platformSize + gap;
        }
        
        // VERTICAL CHALLENGE
        // =================
        
        // Create a tower with spiraling platforms
        const towerRadius = 10;
        const towerHeight = 40;
        const platformsPerRotation = 12;
        const totalSpirals = 24
        
        // Create central column
        this.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-3, 0, -30),
            new THREE.Vector3(3, towerHeight, -24),
            obstacleMaterial,
            "tower-column"
        ));
        
        // Create spiral platforms
        for (let i = 0; i < totalSpirals; i++) {
            const angle = (i / platformsPerRotation) * Math.PI * 2;
            const height = (i / totalSpirals) * towerHeight;
            const radius = towerRadius - (i / totalSpirals) * 5; // Spiral gets tighter
            
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius - 27; // Center at z=-27
            
            this.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(x - 2.5, height, z - 2.5),
                new THREE.Vector3(x + 2.5, height + 1.0, z + 2.5),
                platformMaterial,
                `spiral-platform-${i}`
            ));
        }
        
        // HIGH CHALLENGE AREA
        // ==================
        
        // Platform at the top of the tower
        // this.addStaticBody(StaticBody.createBox(
        //     new THREE.Vector3(-7, towerHeight, -34),
        //     new THREE.Vector3(7, towerHeight + 1, -20),
        //     platformMaterial,
        //     "tower-top"
        // ));
        
        // Bridge to elevated challenge area
        this.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-2, towerHeight, -40),
            new THREE.Vector3(2, towerHeight + 1, -34),
            platformMaterial,
            "high-bridge"
        ));
        
        // Elevated challenge area with moving platforms (visual only, not actually moving)
        this.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-15, towerHeight, -60),
            new THREE.Vector3(15, towerHeight + 1, -40),
            platformMaterial,
            "challenge-area"
        ));
        
        // Floating obstacle blocks
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * 20 - 10;
            const z = Math.random() * 15 - 55;
            const size = Math.random() * 2 + 1;
            
            this.addStaticBody(StaticBody.createBox(
                new THREE.Vector3(x - size/2, towerHeight + 3, z - size/2),
                new THREE.Vector3(x + size/2, towerHeight + 3 + size, z + size/2),
                obstacleMaterial,
                `floating-obstacle-${i}`
            ));
        }
        
        // FINAL AREA - HIGH PLATFORM
        // =========================
        
        // Keep the high platform at y=100 as the final challenge/destination
        this.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-15, 100, -15),
            new THREE.Vector3(15, 102, 15),
            new THREE.MeshStandardMaterial({
                color: 0xffd700, // Gold color for the final platform
                roughness: 0.3,
                metalness: 0.8
            }),
            "final-platform"
        ));
        
        // Add a teleporter visual hint to reach the final platform (not functional, just visual)
        this.addStaticBody(StaticBody.createBox(
            new THREE.Vector3(-1, towerHeight + 1, -50),
            new THREE.Vector3(1, towerHeight + 5, -48),
            new THREE.MeshStandardMaterial({
                color: 0xffaa00,
                roughness: 0.3,
                metalness: 0.8,
                emissive: 0xffaa00,
                emissiveIntensity: 0.5
            }),
            "teleporter-visual"
        ));
        
        console.log("Complex level created with multiple platforms and challenges");
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
            this.cameraTheta += deltaX * sensitivity;
            this.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraPhi + deltaY * sensitivity));
            
            // Log camera rotation for debugging
            console.log(`Camera rotation: theta=${this.cameraTheta.toFixed(2)}, phi=${this.cameraPhi.toFixed(2)}`);
        });
        
        // Set the zoom callback
        this.mobileControls.setZoomCallback((zoomDelta) => {
            // Adjust camera distance with higher sensitivity
            this.cameraDistance = Math.max(2, Math.min(20, this.cameraDistance - zoomDelta * 2)); // Multiplied by 2 for more sensitivity
            console.log(`Camera zoom: distance=${this.cameraDistance.toFixed(2)}`);
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
        document.body.appendChild(this.renderer.domElement);
        
        // Scene background (sky color)
        this.scene.background = new THREE.Color(0xffe6f2);
        
        // Setup camera
        this.camera.position.set(0, 8, 8);
        this.camera.lookAt(0, 0, 0);

        // Add lighting based on performance mode
        this.setupLighting();

        // Set up event listeners
        this.setupControls();
        
        // Add fullscreen button for desktop users
        if (!this.isMobile) {
            this.addDesktopFullscreenButton();
        }
        
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Ensure mobile controls are set up immediately after initialization if on mobile
        if (this.isMobile && !this.mobileControls) {
            this.setupMobileControls();
        }
    }

    /**
     * Set up lighting based on current performance mode
     */
    private setupLighting(): void {
        // Clear existing lights
        this.scene.children = this.scene.children.filter(child => !(child instanceof THREE.Light));
        
        // Add ambient light (used in both modes)
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);
        
        if (this.highPerformanceMode) {
            // High performance mode: multiple lights with shadows
            const directionalLight = new THREE.DirectionalLight(0xfff0e6, 0.7);
            directionalLight.position.set(5, 20, 7.5);
            directionalLight.name = 'mainDirectionalLight'; // Add name for reference
            
            // Setup shadow details for high performance mode
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 150;
            directionalLight.shadow.camera.left = -60;
            directionalLight.shadow.camera.right = 60;
            directionalLight.shadow.camera.top = 60;
            directionalLight.shadow.camera.bottom = -60;
            directionalLight.shadow.bias = -0.0005;
            
            this.scene.add(directionalLight);
            
            // Additional lights for high performance mode - reduced number for efficiency
            const lightPositions = [
                { pos: new THREE.Vector3(0, 5, 0), color: 0xff9ee0, intensity: 0.5, distance: 20 },
                { pos: new THREE.Vector3(0, 40, -30), color: 0xff9ee0, intensity: 0.5, distance: 30 },
                { pos: new THREE.Vector3(0, 100, 0), color: 0xffffaa, intensity: 0.7, distance: 40 }
            ];
            
            for (const lightData of lightPositions) {
                const pointLight = new THREE.PointLight(
                    lightData.color, 
                    lightData.intensity, 
                    lightData.distance
                );
                pointLight.position.copy(lightData.pos);
                pointLight.castShadow = true;
                this.scene.add(pointLight);
            }
        } else {
            // Low performance mode: just one directional light, no shadows
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
            directionalLight.position.set(5, 20, 7.5);
            this.scene.add(directionalLight);
            
            // Add one simple point light for the final platform - no shadows
            const finalPlatformLight = new THREE.PointLight(0xffffaa, 0.7, 40);
            finalPlatformLight.position.set(0, 100, 0);
            this.scene.add(finalPlatformLight);
        }
    }

    /**
     * Update the directional light's shadow camera to follow the player
     */
    private updateShadowCamera(): void {
        if (!this.highPerformanceMode || !this.localPlayer) return;
        
        // Find the main directional light
        const directionalLight = this.scene.getObjectByName('mainDirectionalLight') as THREE.DirectionalLight;
        if (!directionalLight || !directionalLight.shadow) return;
        
        // Get player position
        const playerPos = this.localPlayer.getPosition();
        
        // Set the shadow camera target to the player position, but keep the light position relative
        const lightOffsetX = 5;
        const lightOffsetY = 20;
        const lightOffsetZ = 7.5;
        
        // Round to the nearest larger unit to reduce shadow flickering 
        // (we don't need pixel-perfect positioning for the shadow camera)
        const targetX = Math.floor(playerPos.x / 5) * 5;
        const targetY = Math.floor(playerPos.y / 5) * 5;
        const targetZ = Math.floor(playerPos.z / 5) * 5;
        
        // Update directional light position to maintain same angle but follow player
        directionalLight.position.set(
            targetX + lightOffsetX,
            targetY + lightOffsetY,
            targetZ + lightOffsetZ
        );
        
        // Update the directional light target
        if (!directionalLight.target.parent) {
            this.scene.add(directionalLight.target);
        }
        directionalLight.target.position.set(targetX, targetY, targetZ);
        
        // Update shadow camera projection
        directionalLight.shadow.camera.updateProjectionMatrix();
    }

    public initComposer(): void {
        // Create a new render target with the correct pixel ratio
        const renderTarget = new THREE.WebGLRenderTarget(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio
        );
        
        // Initialize composer with the high-resolution render target
        this.composer = new EffectComposer(this.renderer, renderTarget);
        
        // Add render pass
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
    }

    public setupSimpleCellShading(): void {
        // Only proceed if in high performance mode
        if (!this.highPerformanceMode) return;
        
        // Set up the composer with a render pass
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        
        // Create a texture gradient for toon materials if not already created
        if (!this.toonTextureGradient) {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 1;
            const context = canvas.getContext('2d');
            if (context) {
                // Create a 4-step gradient that's not too dark
                const gradient = context.createLinearGradient(0, 0, 64, 0);
                gradient.addColorStop(0, "#555555");    // Dark tone but not pure black
                gradient.addColorStop(0.3, "#777777");  // Softer shadow tone
                gradient.addColorStop(0.6, "#BBBBBB");  // Lighter mid tone
                gradient.addColorStop(1, "#FFFFFF");    // Highlight
                
                context.fillStyle = gradient;
                context.fillRect(0, 0, 64, 1);
                
                this.toonTextureGradient = new THREE.CanvasTexture(canvas);
                this.toonTextureGradient.colorSpace = THREE.SRGBColorSpace;
            }
        }
    }
    
    /**
     * Set up keyboard input tracking (only track state, don't update player here)
     */
    private setupControls(): void {
        // Mouse controls for camera rotation
        this.renderer.domElement.addEventListener('mousedown', (event) => {
            this.isDragging = true;
            this.previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
            
            // Request pointer lock on mouse down for desktop fullscreen
            if (document.fullscreenElement && !document.pointerLockElement) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        this.renderer.domElement.addEventListener('mousemove', (event) => {
            // If pointer is locked (fullscreen mode)
            if (document.pointerLockElement === this.renderer.domElement) {
                // Use movement instead of absolute position
                const deltaMove = {
                    x: event.movementX,
                    y: event.movementY
                };
                
                this.cameraTheta += deltaMove.x * 0.002; // Adjusted sensitivity
                // Invert Y movement in fullscreen mode for more intuitive control
                this.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraPhi - deltaMove.y * 0.002));
            }
            // Regular dragging (outside fullscreen)
            else if (this.isDragging) {
                const deltaMove = {
                    x: event.clientX - this.previousMousePosition.x,
                    y: event.clientY - this.previousMousePosition.y
                };

                this.cameraTheta += deltaMove.x * 0.01;
                // Keep Y movement non-inverted for regular dragging
                this.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraPhi + deltaMove.y * 0.01));

                this.previousMousePosition = {
                    x: event.clientX,
                    y: event.clientY
                };
            }
        });

        this.renderer.domElement.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Add pointer lock change and error event listeners
        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
        document.addEventListener('pointerlockerror', () => {
            console.error('Pointer lock error');
        });

        // Wheel for zoom
        this.renderer.domElement.addEventListener('wheel', (event) => {
            this.cameraDistance = Math.max(4, Math.min(20, this.cameraDistance + event.deltaY * 0.01));
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
    }

    /**
     * Handle pointer lock change
     */
    private onPointerLockChange(): void {
        if (document.pointerLockElement === this.renderer.domElement) {
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

    public updateCamera(): void {
        // Update camera target to follow the local player if available
        if (this.localPlayer) {
            // Get player position
            const playerPos = this.localPlayer.getPosition();
            
            // Smoothly move camera target towards player position
            this.cameraTarget.lerp(playerPos, 0.1);
        }
        
        // Calculate camera position based on spherical coordinates
        const x = this.cameraDistance * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
        const y = this.cameraDistance * Math.cos(this.cameraPhi);
        const z = this.cameraDistance * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);

        this.camera.position.set(
            this.cameraTarget.x + x,
            this.cameraTarget.y + y,
            this.cameraTarget.z + z
        );
        this.camera.lookAt(this.cameraTarget);
    }

    public addPlayer(id: string, isLocal: boolean = false): Player {
        const player = new Player(id, this.toonTextureGradient || undefined, isLocal && this.toonShadowsEnabled);
        this.players.set(id, player);
        
        // Move player to start on high platform if it's the local player
        if (isLocal) {
            player.move(new THREE.Vector3(0, 5, 0)); // Position above the platform
            this.localPlayer = player;
            
            // Also update camera target to the high platform
            //this.cameraTarget.set(0, 105, 0);
        }

        return player;
    }

    public removePlayer(id: string): void {
        const player = this.players.get(id);
        if (player) {
            this.players.delete(id);
        }
    }

    public getPlayer(id: string): Player | undefined {
        return this.players.get(id);
    }

    public onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Set appropriate pixel ratio based on performance mode
        if (this.highPerformanceMode) {
            this.renderer.setPixelRatio(window.devicePixelRatio);
        } else {
            this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
        }
        
        // Recreate the composer only in high performance mode
        if (this.highPerformanceMode) {
            this.initComposer();
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
            
            // Execute the fixed update
            this.fixedUpdate();
            updated = true;
            
            // Prevent spiral of death by capping accumulated time
            if (this.accumulatedTime > this.timestep * 5) {
                this.accumulatedTime = this.timestep * 5;
            }
        }
        
        // Only render if we did at least one fixed update
        if (updated) {
            // Update camera
            this.updateCamera();
            
            // Render based on performance mode
            if (this.highPerformanceMode && this.composer) {
                this.composer.render();
            } else {
                this.renderer.render(this.scene, this.camera);
            }
        }
        
        // Continue the game loop
        requestAnimationFrame(this.update.bind(this));
    }

    public fixedUpdate(): void {
        // Calculate the forward vector using cameraPhi and cameraTheta
        const forwardX = -Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
        const forwardZ = -Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);

        // Update the local player's forward vector
        if (this.localPlayer) {
            this.localPlayer.forward.set(forwardX, 0, forwardZ).normalize();
            
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
            
            this.localPlayer.handleInput({
                w: this.inputKeys['w'] || mobileInput.w || false,
                a: this.inputKeys['a'] || mobileInput.a || false,
                s: this.inputKeys['s'] || mobileInput.s || false,
                d: this.inputKeys['d'] || mobileInput.d || false,
                space: this.inputKeys[' '] || mobileInput.space || false,
                shift: this.inputKeys['shift'] || mobileInput.shift || false
            });
        }

        // Update all players
        this.players.forEach(player => {
            player.fixedUpdate();
            
            // Add rope interaction check
            this.checkPlayerRopeInteraction(player);
            
            // Check collisions with static bodies after player movement
            this.checkPlayerCollisions(player);
        });
        
        // Update shadow map camera to follow player
        this.updateShadowCamera();
        
        this.players.forEach(player => player.setDebugMode(true));
        
        // Reset the instanced renderer and render all players
        this.instancedRenderer.reset();
        this.players.forEach(player => {
            player.render(this.instancedRenderer);
        });
        
        // Draw test ring after player rendering
        this.testTime += 0.016; // Consistent time increment (roughly 60fps)
        
        // Draw a simple animated structure
        const center = new THREE.Vector3(0, 5, 0);
        const radius = 2;
        const segments = 12;
        
        // Reuse these vectors outside the loop
        const pos1 = new THREE.Vector3();
        const pos2 = new THREE.Vector3();

        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2 + this.testTime;
            const angle2 = ((i + 1) / segments) * Math.PI * 2 + this.testTime;
            
            pos1.set(
                center.x + Math.cos(angle1) * radius,
                center.y + Math.sin(this.testTime * 2) * 0.5,
                center.z + Math.sin(angle1) * radius
            );
            
            pos2.set(
                center.x + Math.cos(angle2) * radius,
                center.y + Math.sin(this.testTime * 2) * 0.5,
                center.z + Math.sin(angle2) * radius
            );
            
            // Use the reused vectors
            this.instancedRenderer.renderBeam(pos1, pos2, 0.1, 0.1, undefined, 0x44aa88);
            this.instancedRenderer.renderSphere(pos1, 0.2, 0x88ccaa);
        }
        
        // Update the instanced renderer after all rendering is done
        this.instancedRenderer.update();
        
        // Update all dynamic bodies with fixed timestep
        this.updateDynamicBodies();
        
        // Check player collisions with dynamic bodies
        this.players.forEach(player => {
            // Check collisions with static bodies (existing code)
            this.checkPlayerCollisions(player);
            
            // Check collisions with dynamic bodies (new code)
            this.checkPlayerDynamicBodyCollisions(player);
            
            // Check collisions with saws
            this.checkPlayerSawCollisions(player);
        });

        // Update and render all ropes
        this.ropes.forEach(rope => {
            rope.update();
            rope.render(this.instancedRenderer, 0xffff22); // Default yellow rope like color
        });

        // Update the circular path for moving saws
        this.updateSawPaths();

        // Update particles with fixed timestep (convert milliseconds to seconds)
        this.particleSystem.update(this.timestep / 1000);

        // Render particles
        this.particleSystem.render();
    }

    /**
     * Check and resolve player collisions with static bodies
     * @param player The player to check collisions for
     */
    public checkPlayerCollisions(player: Player): void {
        // Get all particles from the player's verlet body
        const particles = player.verletBody.getParticles();
        
        // Check collision for each particle against each static body
        for (const particle of particles) {
            // Use the particle's position and radius for collision detection
            const particlePosition = particle.position;
            const particleRadius = particle.radius;
            
            // Check collision with each static body
            for (const body of this.staticBodies) {
                const translation = body.collideWithSphere(particlePosition, particleRadius);
                
                // If collision detected, resolve it
                if (translation) {
                    // Move the particle out of collision using the MTV
                    particlePosition.add(translation);
                    
                    // Compute velocity vector
                    const velocity = new THREE.Vector3().subVectors(
                        particlePosition,
                        particle.previousPosition
                    );
                    
                    // Get the normal from the translation vector
                    const normal = translation.clone().normalize();
                    
                    // Project velocity onto normal and tangent planes
                    const velAlongNormal = velocity.dot(normal);
                    const normalComponent = normal.clone().multiplyScalar(velAlongNormal);
                    const tangentComponent = velocity.clone().sub(normalComponent);
                    
                    // Apply friction to tangential component
                    const friction = 0.2; // Friction coefficient (1 = no friction, 0 = full friction)
                    tangentComponent.multiplyScalar(friction);
                    
                    // New velocity is just the tangential component (no bounce)
                    const newVelocity = tangentComponent;
                    
                    // Update the previous position to create this new velocity
                    particle.previousPosition.copy(particlePosition).sub(newVelocity);
                }
            }
        }
    }

    /**
     * Update all dynamic bodies - always using fixed timestep
     */
    private updateDynamicBodies(): void {
        this.dynamicBodies.forEach(body => {
            // Update physics with no timestep parameter
            body.update();
            
            // Apply constraints and boundaries
            this.applyDynamicBodyBoundaries(body);
        });
        
        // Update all saws
        this.saws.forEach(saw => {
            saw.update();
        });
    }
    
    /**
     * Apply boundary conditions to dynamic bodies to create movement patterns
     */
    private applyDynamicBodyBoundaries(body: RigidBody): void {
        const pos = body.shape.position;
        
        // Use constant velocities - never scaled by deltaTime
        const HORIZONTAL_VELOCITY = 0.05;
        const VERTICAL_VELOCITY = 0.04;
        const ROTATION_VELOCITY = 0.02;
        const FAST_ROTATION_VELOCITY = 0.1;
        
        // For horizontal moving platforms - reverse at x boundaries
        if (Math.abs(body.velocity.x) > 0.01 && Math.abs(body.velocity.y) < 0.01) {
            if (Math.abs(pos.x) > 12) {
                // Always use a constant velocity when reversing direction
                body.velocity.x = (body.velocity.x > 0) ? -HORIZONTAL_VELOCITY : HORIZONTAL_VELOCITY;
            }
        }
        
        // For vertical moving platforms - reverse at y boundaries
        if (Math.abs(body.velocity.y) > 0.01 && Math.abs(body.velocity.x) < 0.01) {
            if (pos.y < 2.2 || pos.y > 6) {
                // Always use a constant velocity when reversing direction
                body.velocity.y = (body.velocity.y > 0) ? -VERTICAL_VELOCITY : VERTICAL_VELOCITY;
            }
        }
        
        // Keep all platforms within general bounds
        const generalBounds = 15;
        if (Math.abs(pos.x) > generalBounds || Math.abs(pos.z) > generalBounds || pos.y < 1 || pos.y > 15) {
            // Reset position if it gets too far away
            body.shape.position.set(0, 3, 0);
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.shape.updateTransform();
        }
        
        // Special handling for the X-axis flipping platform
        // If this is the flipping platform (identified by rotation on X axis)
        if (Math.abs(body.angularVelocity.x) > 0.04) {
            // Keep it in place in Z position and don't change its rotation speed
            body.velocity.set(0, 0, 0); // Make it stay in one place
            
            // Make sure it maintains the fast rotation - might get dampened otherwise
            if (Math.abs(body.angularVelocity.x) < FAST_ROTATION_VELOCITY) {
                body.angularVelocity.x = (body.angularVelocity.x > 0) ? 
                    FAST_ROTATION_VELOCITY : -FAST_ROTATION_VELOCITY;
            }
        }
    }
    
    /**
     * Check and resolve player collisions with dynamic bodies
     * @param player The player to check collisions for
     */
    public checkPlayerDynamicBodyCollisions(player: Player): void {
        // Get all particles from the player's verlet body
        const particles = player.verletBody.getParticles();
        
        // Check collision for each particle against each dynamic body
        for (const particle of particles) {
            const particlePosition = particle.position;
            const particleRadius = particle.radius;
            
            // Check against all dynamic bodies
            for (const body of this.dynamicBodies) {
                const translation = body.shape.collideWithSphere(particlePosition, particleRadius);
                
                // If collision detected, resolve it
                if (translation) {
                    // Move the particle out of collision using the translation vector
                    particlePosition.add(translation);
                    
                    // Compute particle velocity
                    const particleVelocity = new THREE.Vector3().subVectors(
                        particlePosition,
                        particle.previousPosition
                    );
                    
                    // Get the normal from the translation vector
                    const normal = translation.clone().normalize();
                    
                    // Project velocity onto normal and tangent planes
                    const velAlongNormal = particleVelocity.dot(normal);
                    const normalComponent = normal.clone().multiplyScalar(velAlongNormal);
                    const tangentComponent = particleVelocity.clone().sub(normalComponent);
                    
                    // Calculate dynamic body velocity at the contact point
                    const bodyVelocity = new THREE.Vector3().copy(body.velocity);
                    
                    // Add angular velocity contribution
                    const contactPoint = particlePosition.clone().sub(translation);
                    const relativePos = contactPoint.clone().sub(body.shape.position);
                    const angularComponent = new THREE.Vector3().crossVectors(
                        body.angularVelocity,
                        relativePos
                    );
                    bodyVelocity.add(angularComponent);
                    
                    // Calculate rebound velocity with some bounce
                    const restitution = 0.0; // 0=no bounce, 1=full bounce
                    const newNormalVelocity = normal.clone().multiplyScalar(-velAlongNormal * restitution);
                    
                    // FIXED: Better blending of velocities with proper friction
                    // First compute the relative tangential velocity
                    const bodyTangentialVel = bodyVelocity.clone().projectOnPlane(normal);
                    const relativeTangentialVel = tangentComponent.clone().sub(bodyTangentialVel);
                    
                    // Apply friction to the relative tangential velocity
                    const friction = 0.2; // Lower value = higher friction
                    relativeTangentialVel.multiplyScalar(friction);
                    
                    // Final tangential velocity = platform velocity + dampened relative velocity
                    const finalTangentialVel = bodyTangentialVel.clone().add(relativeTangentialVel);
                    
                    // Combine normal and tangential components
                    const newParticleVelocity = finalTangentialVel.clone().add(newNormalVelocity);
                    
                    // Update the previous position to create this new velocity
                    particle.previousPosition.copy(particlePosition).sub(newParticleVelocity);
                }
            }
        }
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

    /**
     * Add a dynamic body to the game
     * @param body The dynamic body to add
     * @returns The added dynamic body
     */
    public addDynamicBody(body: RigidBody): RigidBody {
        this.dynamicBodies.push(body);
        this.scene.add(body.mesh);
        return body;
    }
    
    /**
     * Create several dynamic platforms
     */
    public createDynamicPlatforms(): void {
        // Create materials for different platforms
        const redMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3366, emissive: 0xff3366, emissiveIntensity: 0.2,
            roughness: 0.4, metalness: 0.6
        });
        
        const blueMaterial = new THREE.MeshStandardMaterial({
            color: 0x3366ff, emissive: 0x3366ff, emissiveIntensity: 0.2,
            roughness: 0.4, metalness: 0.6
        });
        
        const greenMaterial = new THREE.MeshStandardMaterial({
            color: 0x33ff66, emissive: 0x33ff66, emissiveIntensity: 0.2,
            roughness: 0.4, metalness: 0.6
        });
        
        const purpleMaterial = new THREE.MeshStandardMaterial({
            color: 0xff33ff, emissive: 0xff33ff, emissiveIntensity: 0.3,
            roughness: 0.3, metalness: 0.7
        });
        
        // Constants for fixed physics behavior (never scaled by deltaTime)
        const HORIZONTAL_VELOCITY = 0.05;
        const VERTICAL_VELOCITY = 0.04;
        const ROTATION_VELOCITY = 0.02;
        const FAST_ROTATION_VELOCITY = 0.02; // Faster rotation for the flipping platform
        
        // 1. Horizontal moving platform - BIGGER
        const horizontalPlatform = RigidBody.createBox(
            new THREE.Vector3(-8, 2.2, 0),
            new THREE.Vector3(8, 1.2, 8), // Increased size
            15.0, // Increased mass
            redMaterial
        );
        horizontalPlatform.velocity.set(HORIZONTAL_VELOCITY, 0, 0);
        this.addDynamicBody(horizontalPlatform);
        
        // 2. Vertical moving platform - BIGGER
        const verticalPlatform = RigidBody.createBox(
            new THREE.Vector3(0, 2.7, -8),
            new THREE.Vector3(8, 0.8, 8), // Increased size
            15.0, // Increased mass
            blueMaterial
        );
        verticalPlatform.velocity.set(0, VERTICAL_VELOCITY, 0);
        this.addDynamicBody(verticalPlatform);

        // 4. NEW: Fast X-axis rotating platform (to flip the player)
        const flippingPlatform = RigidBody.createBox(
            new THREE.Vector3(0, 3.5, 8), // Position it on the positive Z side
            new THREE.Vector3(6, 2, 25), // Long but narrow platform for better flipping
            12.0,
            purpleMaterial
        );
        
        // Set fast rotation on X axis to create the flipping effect
        flippingPlatform.angularVelocity.set(FAST_ROTATION_VELOCITY, 0, 0);
        this.addDynamicBody(flippingPlatform);
    }

    /**
     * Add a rope to the game
     * @param fixedPoint The point where the rope is attached
     * @param segments Number of segments in the rope
     * @param length Total length of the rope
     * @param radius Radius of each rope particle
     * @param color Color of the rope
     * @returns The created rope
     */
    public addRope(
        fixedPoint: THREE.Vector3,
        segments: number = 10,
        length: number = 5,
        radius: number = 0.1,
        color: number = 0xff0000
    ): Rope {
        const rope = new Rope(fixedPoint, segments, length, radius);
        this.ropes.push(rope);
        return rope;
    }
    
    // Add this to the init method or constructor
    public createTestRopes(): void {
        // Create a few test ropes at different locations
        this.addRope(
            new THREE.Vector3(5, 25, 0),    // Higher fixed point
            15,                             // More segments
            20,                             // Longer length
            0.2,                            // Thicker radius
            0xff2222                        // Red color
        );
        
        let rope = this.addRope(
            new THREE.Vector3(-5, 30, 3),   // Higher fixed point
            15,                             // More segments
            20,                             // Longer length
            0.2,                            // Thicker radius
            0x22ff22                        // Green color
        );
        rope.endParticle.applyImpulse(new THREE.Vector3(0, 0, 10));
        
        // Add a rope from the final platform
        this.addRope(
            new THREE.Vector3(0, 102, 0),   // From top of the gold platform
            30,                             // More segments for longer rope
            30,                             // Much longer length
            0.2,                            // Thicker radius
            0xffff22                        // Yellow color
        );
    }
    
    // Add method to get rope by index
    public getRope(index: number): Rope | undefined {
        if (index >= 0 && index < this.ropes.length) {
            return this.ropes[index];
        }
        return undefined;
    }

    public checkPlayerRopeInteraction(player: Player): void {
        const playerPos = player.getPosition();
        const interactionRadius = 3.0; // How close player needs to be to grab rope
        
        // If player already has a rope, don't check for new ones
        if (player.rope) return;
        
        // Only check for rope interaction if space key is pressed
        // Check using the input system instead of directly accessing the private isJumping property
        const spacePressed = this.inputKeys[' '] || false;
        
        // For mobile, get the status from mobile controls
        let mobileJumping = false;
        if (this.isMobile && this.mobileControls) {
            const buttonState = this.mobileControls.getInputState();
            mobileJumping = buttonState.space;
        }
        
        // Only continue if space is pressed (either keyboard or mobile)
        if (!spacePressed && !mobileJumping) return;
        
        // Check each rope's end position against player position
        for (const rope of this.ropes) {
            const ropeEndPos = rope.getEndPosition();
            const distanceToRope = playerPos.distanceTo(ropeEndPos);
            
            if (distanceToRope < interactionRadius) {
                player.rope = rope;
                console.log("Player grabbed rope with spacebar!");
                break;
            }
        }
    }

    /**
     * Add a fullscreen button for desktop users
     */
    private addDesktopFullscreenButton(): void {
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
                        if (this.renderer.domElement && !document.pointerLockElement) {
                            this.renderer.domElement.requestPointerLock();
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

    /**
     * Create dangerous saw blades
     */
    public createSaws(): void {
        // Create a single test saw
        const testSaw = new Saw(
            new THREE.Vector3(10, 8, 0),  // Position
            4.0,                          // Radius
            0.8,                          // Thickness
            0.05                           // Spin speed
        );
        this.addSaw(testSaw);
    }
    
    /**
     * Add a saw to the game
     * @param saw The saw to add
     * @returns The added saw
     */
    public addSaw(saw: Saw): Saw {
        this.saws.push(saw);
        this.scene.add(saw.mesh);
        return saw;
    }
    
    /**
     * Check and resolve player collisions with saws
     * @param player The player to check collisions for
     */
    public checkPlayerSawCollisions(player: Player): void {
        // Get all particles from the player's verlet body
        const particles = player.verletBody.getParticles();
        
        // Check collision for each particle against each saw
        for (const particle of particles) {
            const particlePosition = particle.position;
            const particleRadius = particle.radius;
            
            // Check against all saws - treat them just like any other rigid body
            for (const saw of this.saws) {
                const translation = saw.body.shape.collideWithSphere(particlePosition, particleRadius);
                
                // If collision detected, resolve it normally
                if (translation) {
                    // Move the particle out of collision
                    particlePosition.add(translation);

                    // Calculate dynamic body velocity at the contact point
                    const bodyVelocity = new THREE.Vector3().copy(saw.body.velocity);
                    
                    // Add angular velocity contribution
                    const contactPoint = particlePosition.clone().sub(translation);
                    const relativePos = contactPoint.clone().sub(saw.body.shape.position);
                    const angularComponent = new THREE.Vector3().crossVectors(
                        saw.body.angularVelocity,
                        relativePos
                    );
                    bodyVelocity.add(angularComponent);
                    
                    const newVelocity = bodyVelocity.multiplyScalar(15);
                    
                    // Update the previous position to create this new velocity
                    particle.previousPosition.copy(particlePosition).sub(newVelocity);

                    // Spawn particles at the contact point
                    this.spawnSawCollisionParticles(
                        contactPoint,
                        bodyVelocity
                    );
                }
            }
        }
    }
    
    /**
     * Update the paths for saws that move in patterns
     */
    private updateSawPaths(): void {
        // Update each saw's physics body
        for (const saw of this.saws) {
            saw.update();
        }
    }

    // Add method to spawn particles when a saw collision occurs
    private spawnSawCollisionParticles(position: THREE.Vector3, sawVelocity: THREE.Vector3): void {
        this.particleSystem.spawnParticleBurst(
            30,  // Lots of particles
            {
                position: position.clone(),
                velocity: sawVelocity.clone().multiplyScalar(10), // High velocity
                radius: 0.3,
                color: 0x00ff55,
                lifetime: 3.0,
                gravity: true,
                elongationFactor: 0.2  // Much lower elongation (was 1.5) for less stretching at high speeds
            },
            4.0,  // Velocity randomization
            0.2,  // Radius variation
            1.0   // Lifetime variation
        );
    }
} 
