import * as THREE from 'three';
import { Player } from './Player';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { StaticBody } from './StaticBody';
import { InstancedRenderer } from './Render';

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

    // Add fixed framerate properties
    public targetFPS: number = 60;
    public timestep: number = 1000 / this.targetFPS; // Fixed timestep in milliseconds (60 FPS)
    public lastUpdateTime: number = 0;
    public accumulatedTime: number = 0;

    // Add this property to the Game class
    public inputKeys: { [key: string]: boolean } = {};

    // Add this property to the Game class
    private instancedRenderer: InstancedRenderer;
    private testTime: number = 0;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Configure high-quality renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Initialize players first
        this.players = new Map();
        this.localPlayer = null;
        
        // Initialize AFTER renderer is set up
        this.init();
        
        // Initialize composer at the end
        this.initComposer();
        
        // Add cell shader setup
        this.setupSimpleCellShading();
        
        // Add a single test box for collision
        this.createTestBox();

        // Initialize the instanced renderer
        this.instancedRenderer = new InstancedRenderer(this.scene);
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

        // // Create main ground area (larger than before)
        // this.addStaticBody(StaticBody.createBox(
        //     new THREE.Vector3(-50, -1, -50), // Min corner
        //     new THREE.Vector3(50, 0, 50), // Max corner - 100x1x100 ground
        //     baseMaterial,
        //     "main-ground"
        // ));
        
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

    public init(): void {
        // Renderer setup
        document.body.appendChild(this.renderer.domElement);
        
        // Scene background (sky color)
        this.scene.background = new THREE.Color(0xffe6f2);
        
        // Setup camera
        this.camera.position.set(0, 8, 8);
        this.camera.lookAt(0, 0, 0);

        // Add some basic lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);
        
        // Use a warm-tinted directional light with broader range
        const directionalLight = new THREE.DirectionalLight(0xfff0e6, 0.7);
        directionalLight.position.set(5, 20, 7.5); // Higher position for broader shadows
        
        // Increase shadow map size for better detail
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        
        // Expand shadow camera frustum to cover more of the level
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 150; // Increased far plane
        directionalLight.shadow.camera.left = -60;
        directionalLight.shadow.camera.right = 60;
        directionalLight.shadow.camera.top = 60;
        directionalLight.shadow.camera.bottom = -60;
        
        this.scene.add(directionalLight);
        
        // Add multiple point lights throughout the level for better illumination
        const lightPositions = [
            { pos: new THREE.Vector3(0, 5, 0), color: 0xff9ee0, intensity: 0.5, distance: 20 },
            { pos: new THREE.Vector3(30, 5, 0), color: 0xff9ee0, intensity: 0.5, distance: 20 },
            { pos: new THREE.Vector3(0, 5, -30), color: 0xff9ee0, intensity: 0.5, distance: 20 },
            { pos: new THREE.Vector3(0, 40, -30), color: 0xff9ee0, intensity: 0.5, distance: 30 }, // Tower light
            { pos: new THREE.Vector3(0, 100, 0), color: 0xffffaa, intensity: 0.7, distance: 40 } // Final platform light
        ];
        
        for (const lightData of lightPositions) {
            const pointLight = new THREE.PointLight(
                lightData.color, 
                lightData.intensity, 
                lightData.distance
            );
            pointLight.position.copy(lightData.pos);
            this.scene.add(pointLight);
        }

        // Add a ground plane with a matching color
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xd4a5bd,  // Muted pink/purple for ground
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Set up event listeners
        this.setupControls();
        window.addEventListener('resize', this.onWindowResize.bind(this));
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
        // Set up the composer
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        
        // Setup initial toon shadows with toggle (disabled by default for performance)
        this.setupToonShadows(false);
    }
    
    public setupControls(): void {
        // Mouse controls for camera rotation
        this.renderer.domElement.addEventListener('mousedown', (event) => {
            this.isDragging = true;
            this.previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        });

        this.renderer.domElement.addEventListener('mousemove', (event) => {
            if (!this.isDragging) return;

            const deltaMove = {
                x: event.clientX - this.previousMousePosition.x,
                y: event.clientY - this.previousMousePosition.y
            };

            this.cameraTheta += deltaMove.x * 0.01;
            this.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraPhi + deltaMove.y * 0.01));

            this.previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        });

        this.renderer.domElement.addEventListener('mouseup', () => {
            this.isDragging = false;
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

        // Add shadow toggle
        window.addEventListener('keydown', (event) => {
            if (event.key === 't' || event.key === 'T') {
                this.toggleToonShadows(!this.toonShadowsEnabled);
                console.log(`Toon shadows ${this.toonShadowsEnabled ? 'enabled' : 'disabled'}`);
            }
        });
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
            //player.move(new THREE.Vector3(0, 105, 0)); // Position above the platform
        }
        
        // Add all player meshes and lines to the scene
        player.getMeshes().forEach(mesh => {
            if (mesh instanceof THREE.Mesh) {
                mesh.castShadow = this.toonShadowsEnabled;
                mesh.receiveShadow = this.toonShadowsEnabled;
            }
            this.scene.add(mesh);
        });

        if (isLocal) {
            this.localPlayer = player;
            
            // Also update camera target to the high platform
            this.cameraTarget.set(0, 105, 0);
        }

        return player;
    }

    public removePlayer(id: string): void {
        const player = this.players.get(id);
        if (player) {
            // Remove all player meshes and lines from the scene
            player.getMeshes().forEach(mesh => {
                this.scene.remove(mesh);
            });
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
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Recreate the composer with the new size
        this.initComposer();
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
            
            // Render
            if (this.composer) {
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
            
            this.localPlayer.handleInput({
                w: this.inputKeys['w'] || false,
                a: this.inputKeys['a'] || false,
                s: this.inputKeys['s'] || false,
                d: this.inputKeys['d'] || false,
                space: this.inputKeys[' '] || false,
                shift: this.inputKeys['shift'] || false
            });
        }

        // Update all players
        this.players.forEach(player => {
            player.fixedUpdate();
            
            // Check collisions with static bodies after player movement
            this.checkPlayerCollisions(player);
        });
        
        this.players.forEach(player => player.setDebugMode(true));

        this.testTime += 0.016; // Consistent time increment (roughly 60fps)
        this.instancedRenderer.reset();

        // Draw a simple animated structure
        const center = new THREE.Vector3(0, 5, 0);
        const radius = 2;
        const segments = 12;

        // Draw a ring of connected spheres and beams
        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2 + this.testTime;
            const angle2 = ((i + 1) / segments) * Math.PI * 2 + this.testTime;
            
            const pos1 = new THREE.Vector3(
                center.x + Math.cos(angle1) * radius,
                center.y + Math.sin(this.testTime * 2) * 0.5,
                center.z + Math.sin(angle1) * radius
            );
            
            const pos2 = new THREE.Vector3(
                center.x + Math.cos(angle2) * radius,
                center.y + Math.sin(this.testTime * 2) * 0.5,
                center.z + Math.sin(angle2) * radius
            );
            
            // Draw connecting beam
            this.instancedRenderer.renderBeam(
                pos1,
                pos2,
                0.1,
                0.1,
                undefined,
                0x44aa88
            );
            
            // Draw sphere at joint
            this.instancedRenderer.renderSphere(
                pos1,
                0.2,
                0x88ccaa
            );
        }

        this.instancedRenderer.update();
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
                    const friction = 0.8; // Friction coefficient (1 = no friction, 0 = full friction)
                    tangentComponent.multiplyScalar(friction);
                    
                    // New velocity is just the tangential component (no bounce)
                    const newVelocity = tangentComponent;
                    
                    // Update the previous position to create this new velocity
                    particle.previousPosition.copy(particlePosition).sub(newVelocity);
                }
            }
        }
    }

    public toggleToonShadows(enabled: boolean): void {
        this.setupToonShadows(enabled);
        
        // Update existing player meshes
        this.players.forEach(player => {
            player.getMeshes().forEach(mesh => {
                if (mesh instanceof THREE.Mesh) {
                    mesh.castShadow = this.toonShadowsEnabled;
                    mesh.receiveShadow = this.toonShadowsEnabled;
                }
            });
            
            // Update player materials
            player.updateToonTexture(this.toonShadowsEnabled ? this.toonTextureGradient || undefined : undefined);
        });
    }

    private setupToonShadows(enabled: boolean = true): void {
        this.toonShadowsEnabled = enabled;
        
        if (!enabled) {
            // Disable shadows on all lights
            this.scene.traverse(object => {
                if (object instanceof THREE.Light) {
                    object.castShadow = false;
                }
            });
            
            // Disable shadow maps on renderer
            this.renderer.shadowMap.enabled = false;
            
            // Hide any shadow-only elements
            if (this.scene.userData.shadowGround) {
                (this.scene.userData.shadowGround as THREE.Mesh).visible = false;
            }
            return;
        }
        
        // Enable shadow maps with an appropriate shadow type
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        
        // Create a more defined gradient texture for toon shading - but not too dark
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
        
        // Configure lighting - keep it bright
        this.scene.traverse(object => {
            if (object instanceof THREE.DirectionalLight) {
                object.castShadow = true;
                object.intensity = 1.0; // Brighter light
                
                // Higher resolution shadow maps
                object.shadow.mapSize.width = 2048;
                object.shadow.mapSize.height = 2048;
                
                // Adjust shadow camera for much larger scene size
                object.shadow.camera.near = 0.5;
                object.shadow.camera.far = 150;
                object.shadow.camera.left = -60;
                object.shadow.camera.right = 60;
                object.shadow.camera.top = 60;
                object.shadow.camera.bottom = -60;
                
                // Fix shadow acne with moderate bias
                object.shadow.bias = -0.0005;
                object.shadow.normalBias = 0;
            } else if (object instanceof THREE.PointLight) {
                object.castShadow = true;
                object.intensity *= 1.2; // Increase intensity
            }
        });
        
        // Make sure ambient light is bright enough
        let hasAmbient = false;
        this.scene.traverse(object => {
            if (object instanceof THREE.AmbientLight) {
                object.intensity = 1.0; // Ensure bright ambient light
                hasAmbient = true;
            }
        });
        
        // Add ambient light if none exists
        if (!hasAmbient) {
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
            this.scene.add(ambientLight);
        }
        
        // Apply toon materials without outlines
        this.scene.traverse(object => {
            if (object instanceof THREE.Mesh && 
                !(object.material instanceof THREE.MeshToonMaterial) && 
                !(object.material instanceof THREE.LineBasicMaterial) &&
                !this.isPlayerMesh(object)) {
                
                // Enable shadow casting/receiving
                object.castShadow = true;
                object.receiveShadow = true;
                
                // Extract color from original material
                let color = new THREE.Color(0xffffff);
                if (object.material.hasOwnProperty('color')) {
                    color = (object.material as any).color;
                    
                    // Brighten the color slightly
                    color.r = Math.min(1.0, color.r * 1.2);
                    color.g = Math.min(1.0, color.g * 1.2);
                    color.b = Math.min(1.0, color.b * 1.2);
                }
                
                // Create simple toon material
                const toonMaterial = new THREE.MeshToonMaterial({
                    color: color,
                    gradientMap: this.toonTextureGradient
                });
                
                // Replace material
                object.material = toonMaterial;
            }
        });
    }

    // Helper method to check if a mesh belongs to a player
    public isPlayerMesh(mesh: THREE.Object3D): boolean {
        let isPlayerMesh = false;
        this.players.forEach(player => {
            if (player.getMeshes().includes(mesh)) {
                isPlayerMesh = true;
            }
        });
        return isPlayerMesh;
    }

    // Add method to set target FPS
    public setTargetFPS(fps: number): void {
        this.targetFPS = fps;
        this.timestep = 1000 / fps;
    }
} 
