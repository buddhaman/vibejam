import * as THREE from 'three';
import { Player } from './Player';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private players: Map<string, Player>;
    private localPlayer: Player | null;
    private cameraDistance: number = 8;
    private cameraTheta: number = 0; // Horizontal angle
    private cameraPhi: number = Math.PI / 3; // Vertical angle (0 to PI)
    private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
    private isDragging: boolean = false;
    private previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };
    private toonShadowsEnabled: boolean = false;
    private toonTextureGradient: THREE.Texture | null = null;

    // Add fixed framerate properties
    private targetFPS: number = 60;
    private timestep: number = 1000 / this.targetFPS; // Fixed timestep in milliseconds (60 FPS)
    private lastUpdateTime: number = 0;
    private accumulatedTime: number = 0;

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
    }

    private init(): void {
        // Renderer setup
        document.body.appendChild(this.renderer.domElement);
        
        // Scene background (sky color)
        this.scene.background = new THREE.Color(0xffe6f2);
        
        // Setup camera
        this.camera.position.set(0, 8, 8);
        this.camera.lookAt(0, 0, 0);

        // Add some basic lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        // Use a warm-tinted directional light
        const directionalLight = new THREE.DirectionalLight(0xfff0e6, 0.7);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);
        
        // Add a subtle pink point light for additional atmosphere
        const pinkLight = new THREE.PointLight(0xff9ee0, 0.5, 20);
        pinkLight.position.set(0, 5, 0);
        this.scene.add(pinkLight);

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

    private initComposer(): void {
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

    private setupSimpleCellShading(): void {
        // Set up the composer
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        
        // Setup initial toon shadows with toggle (disabled by default for performance)
        this.setupToonShadows(false);
    }
    
    private setupControls(): void {
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

        // Keyboard controls for player movement
        const keys: { [key: string]: boolean } = {};
        window.addEventListener('keydown', (event) => {
            keys[event.key.toLowerCase()] = true;
        });
        window.addEventListener('keyup', (event) => {
            keys[event.key.toLowerCase()] = false;
        });

        // Add shadow toggle
        window.addEventListener('keydown', (event) => {
            if (event.key === 't' || event.key === 'T') {
                this.toggleToonShadows(!this.toonShadowsEnabled);
                console.log(`Toon shadows ${this.toonShadowsEnabled ? 'enabled' : 'disabled'}`);
            }
        });

        // Update player input
        const updatePlayerInput = () => {
            this.localPlayer?.handleInput({
                w: keys['w'] || false,
                a: keys['a'] || false,
                s: keys['s'] || false,
                d: keys['d'] || false
            });
            requestAnimationFrame(updatePlayerInput);
        };
        updatePlayerInput();
    }

    private updateCamera(): void {
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

    private onWindowResize(): void {
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

    private fixedUpdate(): void {
        // Calculate the forward vector using cameraPhi and cameraTheta
        const forwardX = -Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
        const forwardZ = -Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);

        // Set the local player's forward vector
        if (this.localPlayer) {
            this.localPlayer.forward.set(forwardX, 0, forwardZ).normalize();
        }

        // Update all players
        this.players.forEach(player => {
            player.fixedUpdate(); // Replace player.update() with player.fixedUpdate()
        });
        
        this.players.forEach(player => player.setDebugMode(true));
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
        this.renderer.shadowMap.type = THREE.PCFShadowMap; // Good balance for toon style
        
        // Create a gradient texture for toon shading (if it doesn't exist yet)
        if (!this.toonTextureGradient) {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 1;
            const context = canvas.getContext('2d');
            if (context) {
                // Simple 3-step gradient for clear toon shading
                const gradient = context.createLinearGradient(0, 0, 64, 0);
                gradient.addColorStop(0, "#444444");    // Dark tone (not pure black for softer look)
                gradient.addColorStop(0.5, "#AAAAAA");  // Mid tone
                gradient.addColorStop(1, "#FFFFFF");    // Highlight
                
                context.fillStyle = gradient;
                context.fillRect(0, 0, 64, 1);
                
                this.toonTextureGradient = new THREE.CanvasTexture(canvas);
                this.toonTextureGradient.colorSpace = THREE.SRGBColorSpace;
            }
        }
        
        // Configure only the main directional light for shadows
        let mainLight: THREE.DirectionalLight | null = null;
        
        this.scene.traverse(object => {
            // Only set up the main directional light for shadows
            if (object instanceof THREE.DirectionalLight && !mainLight) {
                mainLight = object;
                object.castShadow = true;
                
                // Reasonable shadow resolution
                object.shadow.mapSize.width = 1024;
                object.shadow.mapSize.height = 1024;
                
                // Adjust shadow camera for scene size
                object.shadow.camera.near = 0.5;
                object.shadow.camera.far = 50;
                object.shadow.camera.left = -10;
                object.shadow.camera.right = 10;
                object.shadow.camera.top = 10;
                object.shadow.camera.bottom = -10;
                
                // Fix shadow acne with moderate bias
                object.shadow.bias = -0.0005;
                
                // No blurring from normalBias (removing the blue tint source)
                object.shadow.normalBias = 0;
                
                // No helper to avoid visual clutter
                // const helper = new THREE.CameraHelper(object.shadow.camera);
                // this.scene.add(helper);
            } else if (object instanceof THREE.PointLight) {
                // Disable shadows on point lights to simplify
                object.castShadow = false;
            }
        });
        
        // Apply toon materials to non-player meshes
        this.scene.traverse(object => {
            if (object instanceof THREE.Mesh && 
                !(object.material instanceof THREE.MeshToonMaterial) && 
                !(object.material instanceof THREE.LineBasicMaterial) &&
                !this.isPlayerMesh(object)) {
                
                // Enable shadow casting/receiving
                object.castShadow = true;
                object.receiveShadow = true;
                
                // Convert material to toon material
                let color = new THREE.Color(0xffffff);
                
                // Safely extract color from original material
                if (object.material.hasOwnProperty('color')) {
                    color = (object.material as any).color;
                }
                
                // Create simple toon material
                const toonMaterial = new THREE.MeshToonMaterial({
                    color: color,
                    gradientMap: this.toonTextureGradient
                });
                
                // Enable shadows
                toonMaterial.receiveShadow = true;
                
                // Replace material
                object.material = toonMaterial;
            }
        });
        
        // Remove any extra shadow-only objects that might be causing issues
        if (this.scene.userData.shadowLight) {
            this.scene.remove(this.scene.userData.shadowLight);
            this.scene.userData.shadowLight = null;
        }
        
        if (this.scene.userData.shadowGround) {
            this.scene.remove(this.scene.userData.shadowGround);
            this.scene.userData.shadowGround = null;
        }
    }

    // Helper method to check if a mesh belongs to a player
    private isPlayerMesh(mesh: THREE.Object3D): boolean {
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