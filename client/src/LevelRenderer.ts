import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { InstancedRenderer } from './Render';
import { Level } from './Level';

export class LevelRenderer {
    public scene: THREE.Scene;
    public renderer: THREE.WebGLRenderer;
    public composer!: EffectComposer;
    public toonShadowsEnabled: boolean = false;
    public toonTextureGradient: THREE.Texture | null = null;
    public instancedRenderer: InstancedRenderer;
    public level: Level;
    public camera: THREE.PerspectiveCamera;
    public cameraDistance: number = 8;
    public cameraTheta: number = 0; // Horizontal angle
    public cameraPhi: number = Math.PI / 3; // Vertical angle (0 to PI)
    public cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

    public highPerformanceMode: boolean = false;    

    constructor(level: Level) {
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.level = level;
        this.scene = new THREE.Scene();

        // Configure renderer with performance detection
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Initialize the instanced renderer
        this.instancedRenderer = new InstancedRenderer(this.scene);
        this.init();
    }

    /**
     * Set up lighting based on current performance mode
     */
    public setupLighting(): void {
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

    public detectDeviceCapabilities(highPerformance: boolean) : void 
    {
        // Apply appropriate renderer settings
        if (!highPerformance) {
            this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
            this.renderer.shadowMap.enabled = false;
        } else {
            // For high performance mode, enable shadows and toon shading by default
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowMap;
            this.toonShadowsEnabled = true;
        }

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
        if (this.level.localPlayer) {
            // Get player position
            const playerPos = this.level.localPlayer.getPosition();
            
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

    public init(): void {
        // Scene background (sky color)
        this.scene.background = new THREE.Color(0xffe6f2);
        
        // Setup camera
        this.camera.position.set(0, 8, 8);
        this.camera.lookAt(0, 0, 0);

        // Add lighting based on performance mode
        this.setupLighting();
    }

    public render(): void {
        if (this.highPerformanceMode && this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        this.instancedRenderer.reset();

        // Reset the instanced renderer and render all players
        this.level.players.forEach(player => {
            player.render(this.instancedRenderer);
        });

        // Update shadow map camera to follow player
        this.updateShadowCamera(this.level.localPlayer!.getPosition());

        // Update and render all ropes
        this.level.ropes.forEach(rope => {
            rope.render(this.instancedRenderer, 0xffff22); // Default yellow rope like color
        });

        // Render particles
        this.level.particleSystem.render(this.instancedRenderer);
        // Update the instanced renderer after all rendering is done
        this.instancedRenderer.update();
    }

    public handleResize(width: number, height: number): void {
        // Update camera aspect ratio
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(width, height);
        
        // Recreate the composer only in high performance mode
        if (this.highPerformanceMode) {
            this.initComposer();
        }
    }
}

