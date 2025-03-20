import * as THREE from 'three';
import { Player } from './Player';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { StaticBody } from './StaticBody';
import { InstancedRenderer } from './Render';
import { RigidBody } from './RigidBody';
import { Rope } from './Rope';

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

    // Add this property to the Game class
    private instancedRenderer: InstancedRenderer;
    private testTime: number = 0;

    // Add rope collection to Game class
    public ropes: Rope[] = [];

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
        
        // Create dynamic platforms
        this.createDynamicPlatforms();
        
        // Create test ropes
        this.createTestRopes();
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
            
            // Add rope interaction check
            this.checkPlayerRopeInteraction(player);
            
            // Check collisions with static bodies after player movement
            this.checkPlayerCollisions(player);
        });
        
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
        });

        // Update and render all ropes
        this.ropes.forEach(rope => {
            rope.update();
            rope.render(this.instancedRenderer, 0xffff22); // Default yellow rope like color
        });
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
                    const friction = 0.5; // Friction coefficient (1 = no friction, 0 = full friction)
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
        this.setupToonShadows(enabled);
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
        
        // 3. Rotating platform - BIGGER
        const rotatingPlatform = RigidBody.createBox(
            new THREE.Vector3(8, 2.2, 0),
            new THREE.Vector3(8, 0.8, 8), // Increased size
            15.0, // Increased mass
            greenMaterial
        );
        rotatingPlatform.angularVelocity.set(0, ROTATION_VELOCITY, 0);
        this.addDynamicBody(rotatingPlatform);
        
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
            20,                             // More segments
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
        
        // Check each rope's end position against player position
        for (const rope of this.ropes) {
            const ropeEndPos = rope.getEndPosition();
            const distanceToRope = playerPos.distanceTo(ropeEndPos);
            
            if (distanceToRope < interactionRadius) {
                player.rope = rope;
                break;
            }
        }
    }
} 
