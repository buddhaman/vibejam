import * as THREE from 'three';

/**
 * Sign class for displaying highscores on a textured mesh
 */
export class Sign {
    private mesh: THREE.Mesh;
    private texture: THREE.CanvasTexture;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private highscores: Array<{username: string, timeMs: number, stars: number}> = [];
    private levelId: number;
    
    /**
     * Create a sign that displays highscores for a level
     * @param position Position of the sign
     * @param rotation Rotation of the sign (in radians)
     * @param width Width of the sign (world units)
     * @param height Height of the sign (world units)
     * @param levelId Level ID to display highscores for
     * @param scene Scene to add the sign to
     */
    constructor(
        position: THREE.Vector3,
        rotation: THREE.Euler,
        width: number = 2,
        height: number = 2.5,
        levelId: number,
        scene: THREE.Scene
    ) {
        this.levelId = levelId;
        
        // CRITICAL FIX: Create a much simpler mesh first with basic color
        // Create a simple colored plane that will definitely show up
        const fallbackGeometry = new THREE.PlaneGeometry(width, height);
        const fallbackMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff, // Bright magenta
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
        this.mesh.position.copy(position);
        this.mesh.rotation.copy(rotation);
        
        // Create debug frame to make the sign more visible
        const frameGeometry = new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.1);
        const frameMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        this.mesh.add(frame);
        
        // Add debug pole to make the sign more visible from a distance
        const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, height * 2, 8);
        const poleMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00
        });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(0, -height / 2, -0.1);
        this.mesh.add(pole);
        
        console.log(`Sign created for level ${levelId} at position ${position.x}, ${position.y}, ${position.z}`);
        
        // Add to scene before updating canvas to ensure it's visible
        scene.add(this.mesh);
        
        // Initialize canvas and texture after the basic mesh is created
        setTimeout(() => {
            console.log("Creating sign canvas texture...");
            // Create canvas and get context
            this.canvas = document.createElement('canvas');
            this.canvas.width = 512;
            this.canvas.height = 640;
            this.context = this.canvas.getContext('2d')!;
            
            // Debug - Fill canvas with a solid color first to verify it's working
            this.context.fillStyle = 'blue';
            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.context.fillStyle = 'white';
            this.context.font = 'bold 48px Arial';
            this.context.textAlign = 'center';
            this.context.fillText(`LEVEL ${levelId} SIGN`, this.canvas.width/2, 100);
            
            // Create texture from canvas
            this.texture = new THREE.CanvasTexture(this.canvas);
            this.texture.minFilter = THREE.LinearFilter;
            this.texture.magFilter = THREE.LinearFilter;
            
            // Now update the mesh material with the texture
            this.mesh.material = new THREE.MeshBasicMaterial({ 
                map: this.texture,
                color: 0xffffff,
                side: THREE.DoubleSide
            });
            
            // Initial rendering - update after adding to scene
            this.updateCanvas();
            
            console.log("Sign texture created and applied");
        }, 100);
    }
    
    /**
     * Add fallback text using Three.js directly
     */
    private addFallbackText(position: THREE.Vector3, width: number, height: number, levelId: number, scene: THREE.Scene): void {
        // Create a bright colored plane as fallback
        const fallbackGeometry = new THREE.PlaneGeometry(width - 0.2, height - 0.2);
        const fallbackMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Bright green
            side: THREE.DoubleSide
        });
        
        const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
        fallbackMesh.position.copy(position);
        fallbackMesh.position.z += 0.01; // Slightly in front of main sign
        fallbackMesh.rotation.copy(this.mesh.rotation);
        
        // Add text directly to the scene as separate objects
        const debugTextMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000, // Red
            side: THREE.DoubleSide
        });
        
        // Add several small cubes to form "LEVEL X" text
        const textHeight = 0.2;
        const textWidth = 0.1;
        const yPos = position.y + height/4;
        
        // L
        const L1 = new THREE.Mesh(
            new THREE.BoxGeometry(textWidth, textHeight*3, 0.05),
            debugTextMaterial
        );
        L1.position.set(position.x - width/3, yPos, position.z + 0.05);
        L1.rotation.copy(this.mesh.rotation);
        
        const L2 = new THREE.Mesh(
            new THREE.BoxGeometry(textWidth*2, textHeight, 0.05),
            debugTextMaterial
        );
        L2.position.set(position.x - width/3 + textWidth, yPos - textHeight, position.z + 0.05);
        L2.rotation.copy(this.mesh.rotation);
        
        // Add these meshes to the scene
        scene.add(fallbackMesh);
        scene.add(L1);
        scene.add(L2);
        
        console.log("Added fallback text display");
    }
    
    /**
     * Render method - called by the renderer
     */
    public render(renderer: any): void {
        // Force texture update on render
        if (this.texture) {
            this.texture.needsUpdate = true;
        }
    }
    
    /**
     * Set highscores for this sign
     */
    public setHighscores(highscores: Array<{username: string, timeMs: number, stars: number}>): void {
        console.log(`Setting ${highscores.length} highscores for level ${this.levelId}`);
        this.highscores = highscores;
        // Update canvas with new highscores
        this.updateCanvas();
    }
    
    /**
     * Update the canvas with current highscores
     */
    private updateCanvas(): void {
        if (!this.context || !this.canvas || !this.texture) {
            console.log("Canvas, context or texture not initialized yet");
            return;
        }
        
        console.log(`Updating canvas for level ${this.levelId}`);
        
        const ctx = this.context;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // VERY BRIGHT DEBUG BACKGROUND - impossible to miss
        ctx.fillStyle = '#FF00FF'; // Hot pink
        ctx.fillRect(0, 0, width, height);
        
        // Add a bright border
        ctx.strokeStyle = '#00FF00'; // Bright green
        ctx.lineWidth = 20;
        ctx.strokeRect(20, 20, width - 40, height - 40);
        
        // Draw title - huge and bright
        ctx.fillStyle = '#FFFFFF'; // White text
        ctx.font = 'bold 72px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // No shadow - keep it simple
        ctx.fillText(`LEVEL ${this.levelId}`, width / 2, 50);
        ctx.fillText(`HIGHSCORES`, width / 2, 130);
        
        // Draw separator
        ctx.beginPath();
        ctx.moveTo(50, 220);
        ctx.lineTo(width - 50, 220);
        ctx.strokeStyle = '#FFFF00'; // Yellow
        ctx.lineWidth = 10;
        ctx.stroke();
        
        // Always show the "no highscores" message for debugging
        ctx.font = '48px Arial, sans-serif';
        ctx.fillText('SIGN TEST', width / 2, height / 2);
        ctx.font = '36px Arial, sans-serif';
        ctx.fillText('CAN YOU SEE THIS?', width / 2, height / 2 + 60);
        
        // CRITICAL: Force texture update
        if (this.texture) {
            this.texture.needsUpdate = true;
            console.log(`Canvas updated for level ${this.levelId}, texture updated`);
        }
        
        // CRITICAL: Make sure the material is using the texture
        if (this.mesh && this.mesh.material) {
            const material = this.mesh.material as THREE.MeshBasicMaterial;
            if (material.map !== this.texture) {
                material.map = this.texture;
                material.needsUpdate = true;
                console.log("Material updated with new texture");
            }
        }
    }
    
    /**
     * Remove the sign from the scene
     */
    public remove(scene: THREE.Scene): void {
        scene.remove(this.mesh);
        this.texture.dispose();
        
        // Dispose geometry and materials
        if (this.mesh.geometry) {
            this.mesh.geometry.dispose();
        }
        
        if (Array.isArray(this.mesh.material)) {
            this.mesh.material.forEach(material => material.dispose());
        } else if (this.mesh.material) {
            this.mesh.material.dispose();
        }
    }
    
    /**
     * Update the sign's position
     */
    public setPosition(position: THREE.Vector3): void {
        this.mesh.position.copy(position);
    }
    
    /**
     * Update the sign's rotation
     */
    public setRotation(rotation: THREE.Euler): void {
        this.mesh.rotation.copy(rotation);
    }
    
    /**
     * Get the sign's mesh
     */
    public getMesh(): THREE.Mesh {
        return this.mesh;
    }
    
    /**
     * Get the sign's level ID
     */
    public getLevelId(): number {
        return this.levelId;
    }
    
    /**
     * Get the sign's highscores
     */
    public getHighscores(): Array<{username: string, timeMs: number, stars: number}> {
        return this.highscores;
    }
}
