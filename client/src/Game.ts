import * as THREE from 'three';
import { Player } from './Player';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

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
        
        // Use a very subtle bloom to avoid pixelation
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.1,   // Very low strength
            0.3,   // Lower radius
            0.9    // Higher threshold
        );
        this.composer.addPass(bloomPass);
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
        const player = new Player(id);
        this.players.set(id, player);
        
        // Add all player meshes and lines to the scene
        player.getMeshes().forEach(mesh => {
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
        // Calculate the forward vector using cameraPhi and cameraTheta
        const forwardX = Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
        const forwardZ = Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);

        // Set the local player's forward vector
        if (this.localPlayer) {
            this.localPlayer.forward.set(forwardX, 0, forwardZ).normalize();
        }

        // Update all players
        this.players.forEach(player => player.update());

        // Update camera
        this.updateCamera();

        // Try direct rendering if composer is causing issues
        if (this.composer) {
            this.composer.render();
        } else {
            // Fallback to direct rendering
            this.renderer.render(this.scene, this.camera);
        }
    }
} 