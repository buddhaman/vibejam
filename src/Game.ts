import * as THREE from 'three';
import { Player } from './Player';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private players: Map<string, Player>;
    private localPlayer: Player | null;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.players = new Map();
        this.localPlayer = null;

        this.init();
    }

    private init(): void {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.z = 5;

        // Add some basic lighting
        const light = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(light);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 0);
        this.scene.add(directionalLight);

        // Add a ground plane
        const groundGeometry = new THREE.PlaneGeometry(10, 10);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    public addPlayer(id: string, isLocal: boolean = false): Player {
        const player = new Player(id);
        this.players.set(id, player);
        this.scene.add(player.mesh);

        if (isLocal) {
            this.localPlayer = player;
        }

        return player;
    }

    public removePlayer(id: string): void {
        const player = this.players.get(id);
        if (player) {
            this.scene.remove(player.mesh);
            this.players.delete(id);
        }
    }

    public updatePlayerPosition(id: string, position: THREE.Vector3): void {
        const player = this.players.get(id);
        if (player) {
            player.updatePosition(position);
        }
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    public update(): void {
        // Update all players
        this.players.forEach(player => player.update());

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
} 