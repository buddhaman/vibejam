import * as THREE from 'three';
import { Player } from './Player';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
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
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.players = new Map();
        this.localPlayer = null;
        this.init();
    }

    private init(): void {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.set(0, 8, 8);
        this.camera.lookAt(0, 0, 0);

        // Add some basic lighting
        const light = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(light);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 0);
        this.scene.add(directionalLight);

        // Add a ground plane
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
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
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    public update(): void {
        // Calculate the forward vector using cameraPhi and cameraTheta
        const forwardX = Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
        const forwardZ = Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);

        // Set the local player's forward vector
        if (this.localPlayer) {
            this.localPlayer.forward.set(forwardX, 0, forwardZ).normalize();
        }

        // Update all players with delta time
        this.players.forEach(player => player.update());

        // Update camera
        this.updateCamera();

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
} 