import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { InstancedRenderer } from './Render';
import { Level } from './Level';
import { ParticleSystem } from './ParticleSystem';
import { SimpleText } from './SimpleText';
import { Camera, CameraMode } from './Camera';

export class LevelRenderer {
    public scene: THREE.Scene;
    public renderer: THREE.WebGLRenderer;
    public composer!: EffectComposer;
    public toonShadowsEnabled: boolean = false;
    public toonTextureGradient: THREE.Texture | null = null;
    public instancedRenderer: InstancedRenderer;
    public level: Level;
    public camera: Camera;
    public highPerformanceMode: boolean = false;    

    // Add particle system
    public particleSystem: ParticleSystem | null = null;

    constructor(level: Level, highPerformance: boolean) {
        // Create Camera with third-person mode by default
        this.camera = new Camera(CameraMode.THIRD_PERSON);
        
        this.level = level;
        this.scene = new THREE.Scene();
        this.highPerformanceMode = highPerformance;

        this.particleSystem = new ParticleSystem();

        // Configure renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        
        // Set up renderer based on performance mode
        if (this.highPerformanceMode) {
            // High performance settings
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowMap;
            this.toonShadowsEnabled = true;
        } else {
            // Low performance settings
            this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
            this.renderer.shadowMap.enabled = false;
            this.toonShadowsEnabled = false;
        }
        
        // Configure renderer size
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Initialize the instanced renderer
        this.instancedRenderer = new InstancedRenderer(this.scene);
        
        // Setup scene
        this.init();
        
        // Initialize composer if in high performance mode
        if (this.highPerformanceMode) {
            this.initComposer();
            this.setupSimpleCellShading();
        }
        
        console.log(`LevelRenderer initialized with ${this.highPerformanceMode ? 'HIGH' : 'LOW'} performance mode`);
        console.log(`Shadows are ${this.renderer.shadowMap.enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Set up lighting based on current performance mode
     */
    public setupLighting(): void {
        // Clear existing lights
        this.scene.children = this.scene.children.filter(child => !(child instanceof THREE.Light));
        
        // Add ambient light (used in both modes)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        if (this.highPerformanceMode) {
            console.log("Setting up high performance lighting with shadows");
            
            // Main directional light with shadows
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
            directionalLight.position.set(10, 30, 10);
            directionalLight.name = 'mainDirectionalLight';
            
            // IMPORTANT: Setup shadow parameters
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 200;
            directionalLight.shadow.camera.left = -50;
            directionalLight.shadow.camera.right = 50;
            directionalLight.shadow.camera.top = 50;
            directionalLight.shadow.camera.bottom = -50;
            directionalLight.shadow.bias = -0.0005;
            
            this.scene.add(directionalLight);
            
            // Helper point lights
            const pointLight1 = new THREE.PointLight(0xffffaa, 1.0, 100);
            pointLight1.position.set(0, 20, 0);
            pointLight1.castShadow = true;
            this.scene.add(pointLight1);
        } else {
            // Simple lighting for low performance mode
            console.log("Setting up low performance lighting without shadows");
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
            directionalLight.position.set(10, 30, 10);
            this.scene.add(directionalLight);
        }
    }

    /**
     * Update the directional light's shadow camera to follow the player
     */
    public updateShadowCamera(position: THREE.Vector3): void {
        if (!this.highPerformanceMode) return;
        
        // Find the main directional light
        const directionalLight = this.scene.getObjectByName('mainDirectionalLight') as THREE.DirectionalLight;
        if (!directionalLight || !directionalLight.shadow) return;
        
        // Get player position
        const playerPos = position;
        
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
        const renderPass = new RenderPass(this.scene, this.camera.threeCamera);
        this.composer.addPass(renderPass);
    }

    public setupSimpleCellShading(): void {
        // Only proceed if in high performance mode
        if (!this.highPerformanceMode) return;
        
        // Set up the composer with a render pass
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera.threeCamera));
        
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

    public detectDeviceCapabilities(highPerformance: boolean): void 
    {
        // IMPORTANT: Set the high performance mode flag
        this.highPerformanceMode = highPerformance;
        console.log(`LevelRenderer: Setting performance mode to ${highPerformance ? 'HIGH' : 'LOW'}`);
        
        // Configure the renderer based on the performance mode
        if (this.highPerformanceMode) {
            // HIGH PERFORMANCE: full shadows
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowMap;
            this.toonShadowsEnabled = true;
            
            // Initialize composer for the rendering pipeline
            this.initComposer();
            this.setupSimpleCellShading();
        } else {
            // LOW PERFORMANCE: no shadows
            this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
            this.renderer.shadowMap.enabled = false;
            this.toonShadowsEnabled = false;
        }
        
        // Setup lighting based on the current mode
        this.setupLighting();
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

    public updateCamera(): void {
        // Update camera target to follow the local player if available
        if (this.level.localPlayer && this.camera.getMode() === CameraMode.THIRD_PERSON) {
            // Get player position
            const playerPos = this.level.localPlayer.getPosition();
            
            // Update the camera with the target position
            this.camera.update(playerPos);
        } else {
            // Update camera without a target (for editor mode)
            this.camera.update();
        }
    }

    public init(): void {
        // Scene background (sky color)
        this.scene.background = new THREE.Color(0xffe6f2);
        
        // Setup camera - this is now handled by the Camera class
        // Just set initial position
        if (this.camera.getMode() === CameraMode.THIRD_PERSON) {
            this.camera.target.set(0, 0, 0);
            this.camera.update();
        } else {
            // For first-person mode, just position the camera
            this.camera.threeCamera.position.set(0, 5, 10);
            this.camera.threeCamera.lookAt(0, 5, 0);
        }

        // Add lighting based on performance mode
        this.setupLighting();
    }

    public render(): void {
        if (this.highPerformanceMode && this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera.threeCamera);
        }

        this.instancedRenderer.reset();

        // Reset the instanced renderer and render all players
        this.level.players.forEach(player => {
            player.render(this.instancedRenderer);
            
            // Update username text
            player.updateUsernameText(this.scene);
        });

        // Update shadow map camera to follow player
        if (this.level.localPlayer) {
            this.updateShadowCamera(this.level.localPlayer.getPosition());
        }

        // Render all ropes
        this.level.ropes.forEach(rope => {
            rope.render(this.instancedRenderer, 0xffff22); // Default yellow rope like color
        });

        // Render all updrafts
        this.level.updrafts.forEach(updraft => {
            updraft.render(this.instancedRenderer, 0xffff22); // Default yellow rope like color
        });

        // Render particles
        // Update particles with fixed timestep (convert milliseconds to seconds)
        this.particleSystem?.update(0.016);
        this.particleSystem?.render(this.instancedRenderer);

        // Render action areas
        this.level.actionAreas?.forEach(actionArea => {
            actionArea.render(this.instancedRenderer, 0.016);
        });

        // Update the instanced renderer after all rendering is done
        this.instancedRenderer.update();
    }

    // Add method to spawn particles when a saw collision occurs
    public spawnSawCollisionParticles(position: THREE.Vector3, sawVelocity: THREE.Vector3): void {
        this.particleSystem?.spawnParticleBurst(
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

    public addSimpleText(
        text: string, 
        position: THREE.Vector3,
        textColor: string = 'white',
        outlineColor: string = 'black'
    ): void {
        new SimpleText(text, position, this.scene, textColor, outlineColor);
    }

    public handleResize(width: number, height: number): void {
        // Update camera aspect ratio using the Camera class
        this.camera.handleResize(width, height);
        
        // Update renderer size
        this.renderer.setSize(width, height);
        
        // Recreate the composer only in high performance mode
        if (this.highPerformanceMode) {
            this.initComposer();
        }
    }

    /**
     * Simple reset method to use with a new level
     * Keeps the WebGL context but clears the scene
     */
    public reset(level: Level): void {
        console.log("Resetting LevelRenderer (keeping WebGL context)");
        
        // Update level reference
        this.level = level;
        
        // Clear the existing scene
        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }
        
        // Reset camera target
        this.camera.target.set(0, 1, 0);
        this.camera.theta = -Math.PI;
        
        // Create new particle system
        this.particleSystem = new ParticleSystem();
        
        // Re-initialize the instanced renderer with the existing scene
        this.instancedRenderer = new InstancedRenderer(this.scene);
        
        // Reset the scene background
        this.scene.background = new THREE.Color(0xffe6f2);
        
        // Reset lighting
        this.setupLighting();
    }
}

