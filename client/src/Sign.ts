import * as THREE from 'three';
import { Entity } from './Entity';

/**
 * Sign class for displaying highscores on a textured mesh
 */
export class Sign extends Entity {
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
        width: number = 3.5,  // Back to original size, we'll use transform scaling 
        height: number = 4.5, // Back to original size, we'll use transform scaling
        levelId: number,
        scene: THREE.Scene
    ) {
        super();
        
        this.levelId = levelId;
        console.log(`Creating sign for level ${levelId}`);
        
        // Create a simple colored plane
        const signGeometry = new THREE.PlaneGeometry(width, height);
        
        // Initialize canvas and texture
        this.canvas = document.createElement('canvas');
        this.canvas.width = 2048;  // Higher resolution for the larger sign
        this.canvas.height = 2560; // Higher resolution for the larger sign
        this.context = this.canvas.getContext('2d')!;
        
        // Fill canvas with a bright color for visibility
        this.context.fillStyle = '#FF00FF'; // Bright pink
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.fillStyle = '#FFFFFF';
        this.context.font = 'bold 240px Arial';
        this.context.textAlign = 'center';
        this.context.fillText(`LEVEL ${levelId}`, this.canvas.width/2, 400);
        
        // Create texture from canvas
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.needsUpdate = true;
        
        // Create a single material for simplicity
        const signMaterial = new THREE.MeshBasicMaterial({
            map: this.texture,
            color: 0xffffff,
            side: THREE.DoubleSide // Visible from both sides
        });
        
        // Use simple flat mesh with a single material
        this.mesh = new THREE.Mesh(signGeometry, signMaterial);
        
        // FIXED POSITIONING: Create a new position instead of modifying the passed one
        const adjustedPosition = position.clone();
        // Move up to position the bottom of the sign at ground level
        // Plus 6 more units to prevent going through the ground
        adjustedPosition.y += height / 2 + 6;
        
        // Set the position directly
        this.mesh.position.copy(adjustedPosition);
        this.mesh.rotation.copy(rotation);
        
        // SCALE UP THE SIGN BY 4x using transform
        this.mesh.scale.set(4, 4, 4);
        
        console.log(`Sign positioned at: ${this.mesh.position.x}, ${this.mesh.position.y}, ${this.mesh.position.z}`);
        console.log(`Sign rotation: ${this.mesh.rotation.x}, ${this.mesh.rotation.y}, ${this.mesh.rotation.z}`);
        console.log(`Sign scale: ${this.mesh.scale.x}, ${this.mesh.scale.y}, ${this.mesh.scale.z}`);
        
        // Add to scene
        scene.add(this.mesh);
        console.log("Sign added to scene");
        
        // Initial rendering - update after adding to scene
        this.updateCanvas();
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
        // Only update the texture occasionally to improve performance
        // We don't need to update every frame since the content rarely changes
        if (this._framesSinceUpdate > 30) { // Update roughly every second at 30fps
            if (this.texture) {
                this.texture.needsUpdate = true;
            }
            this._framesSinceUpdate = 0;
        } else {
            this._framesSinceUpdate++;
        }
    }
    
    private _framesSinceUpdate: number = 0;
    
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
        
        console.log(`Updating canvas for level ${this.levelId} with ${this.highscores.length} highscores`);
        
        const ctx = this.context;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Simple bright background for maximum visibility
        ctx.fillStyle = '#FF00FF'; // Bright pink
        ctx.fillRect(0, 0, width, height);
        
        // Add a border
        ctx.strokeStyle = '#FFCC00';  // Gold border
        ctx.lineWidth = 60;
        ctx.strokeRect(60, 60, width - 120, height - 120);
        
        // Draw title with large text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 180px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // Draw the level title
        ctx.fillText(`LEVEL ${this.levelId}`, width / 2, 120);
        ctx.font = 'bold 160px Arial, sans-serif';
        ctx.fillText(`HIGHSCORES`, width / 2, 320);
        
        // Draw a separator
        ctx.beginPath();
        ctx.moveTo(width * 0.1, 550);
        ctx.lineTo(width * 0.9, 550);
        ctx.strokeStyle = '#FFCC00';
        ctx.lineWidth = 20;
        ctx.stroke();
        
        // Display highscores or 'no highscores' message
        if (this.highscores.length === 0) {
            ctx.font = 'bold 140px Arial, sans-serif';
            ctx.fillText('No highscores yet!', width / 2, height / 2);
            ctx.font = '100px Arial, sans-serif';
            ctx.fillText('Be the first to complete this level!', width / 2, height / 2 + 200);
        } else {
            // Draw highscores - up to 5 entries
            const startY = 650;
            const lineHeight = 300;
            const maxScores = Math.min(5, this.highscores.length);
            
            for (let i = 0; i < maxScores; i++) {
                const score = this.highscores[i];
                const y = startY + i * lineHeight;
                
                // Background for each row
                ctx.fillStyle = (i === 0) ? '#FFD700' : (i === 1) ? '#C0C0C0' : (i === 2) ? '#CD7F32' : '#333333';
                ctx.globalAlpha = 0.3;
                ctx.fillRect(width * 0.1, y, width * 0.8, lineHeight - 40);
                ctx.globalAlpha = 1.0;
                
                // Rank number
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 120px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${i + 1}`, width * 0.2, y + 80);
                
                // Username & time
                ctx.textAlign = 'left';
                ctx.font = '100px Arial, sans-serif';
                
                // Format username
                let username = score.username;
                if (username.length > 15) {
                    username = username.substring(0, 13) + '...';
                }
                ctx.fillText(username, width * 0.3, y + 80);
                
                // Format time
                const minutes = Math.floor(score.timeMs / 1000 / 60);
                const seconds = Math.floor((score.timeMs / 1000) % 60);
                const milliseconds = Math.floor((score.timeMs % 1000) / 10);
                const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
                
                ctx.fillText(timeString, width * 0.3, y + 200);
                
                // Stars
                let starsText = '';
                for (let j = 0; j < score.stars; j++) {
                    starsText += '⭐';
                }
                ctx.textAlign = 'right';
                ctx.fillText(starsText, width * 0.9, y + 150);
            }
        }
        
        // Force texture update
        if (this.texture) {
            this.texture.needsUpdate = true;
            console.log("Sign texture updated");
        }
        
        // Make sure the material is using the texture
        if (this.mesh && this.mesh.material) {
            const material = this.mesh.material as THREE.MeshBasicMaterial;
            if (material.map !== this.texture) {
                material.map = this.texture;
                material.needsUpdate = true;
                console.log("Sign material updated");
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
    
    /**
     * Static debugging method to help check visibility of all signs in the scene
     * @param scene The THREE.js scene to check for signs
     */
    public static debugAllSigns(scene: THREE.Scene): void {
        console.log("Debugging all signs in scene");
        
        // Count of sign-like objects found
        let signCount = 0;
        
        // Look through all objects in the scene
        scene.traverse(object => {
            // Check if object has a name containing "sign"
            if (object.name && object.name.toLowerCase().includes("sign")) {
                signCount++;
                console.log(`Found object named ${object.name}`);
                console.log(`Position: ${object.position.x}, ${object.position.y}, ${object.position.z}`);
                console.log(`Visible: ${object.visible}`);
            }
            
            // Check if this is a mesh with materials that might be signs
            if (object instanceof THREE.Mesh) {
                const mesh = object as THREE.Mesh;
                
                // Log info about this mesh
                console.log(`Found mesh at position ${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z}`);
                console.log(`Visible: ${mesh.visible}, Scale: ${mesh.scale.x}, ${mesh.scale.y}, ${mesh.scale.z}`);
                
                // Check materials on this mesh
                if (Array.isArray(mesh.material)) {
                    console.log(`Mesh has ${mesh.material.length} materials`);
                    mesh.material.forEach((mat, i) => {
                        const material = mat as THREE.Material;
                        console.log(`Material ${i} type: ${material.type}, visible: ${material.visible}`);
                        
                        // If it's a MeshBasicMaterial, check if it has a texture
                        if (material.type === 'MeshBasicMaterial') {
                            const basicMat = material as THREE.MeshBasicMaterial;
                            console.log(`Material ${i} has texture: ${basicMat.map ? 'Yes' : 'No'}`);
                        }
                    });
                } else if (mesh.material) {
                    const material = mesh.material as THREE.Material;
                    console.log(`Mesh has material type: ${material.type}`);
                    
                    // If it's a MeshBasicMaterial, check if it has a texture
                    if (material.type === 'MeshBasicMaterial') {
                        const basicMat = material as THREE.MeshBasicMaterial;
                        console.log(`Material has texture: ${basicMat.map ? 'Yes' : 'No'}`);
                    }
                }
            }
        });
        
        console.log(`Found ${signCount} objects with 'sign' in their name`);
    }
    
    /**
     * Debug method to make this sign more visible by adding a bright colored box around it
     */
    public makeVisible(): void {
        // Add a bright colored helper object
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        const boxMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Bright green
            wireframe: true,
            side: THREE.DoubleSide
        });
        
        const helperBox = new THREE.Mesh(boxGeometry, boxMaterial);
        helperBox.scale.set(15, 20, 3); // Make it slightly larger than the sign
        helperBox.position.set(0, 0, -0.5); // Position it slightly behind the sign
        
        this.mesh.add(helperBox);
        console.log("Added visibility helper to sign");
    }
}
