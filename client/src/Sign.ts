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
        width: number = 3.5,  // Back to original size, we'll use transform scaling 
        height: number = 4.5, // Back to original size, we'll use transform scaling
        levelId: number,
        scene: THREE.Scene
    ) {
        
        this.levelId = levelId;
        
        // Create a simple colored plane with bright colors but no debug elements
        const signGeometry = new THREE.PlaneGeometry(width, height);
        const signMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff, // White base color
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(signGeometry, signMaterial);
        
        // FIXED POSITIONING: Create a new position instead of modifying the passed one
        const adjustedPosition = position.clone();
        // Move up to position the bottom of the sign at ground level
        adjustedPosition.y += height / 2; 
        
        // Set the position directly
        this.mesh.position.copy(adjustedPosition);
        this.mesh.rotation.copy(rotation);
        
        // SCALE UP THE SIGN BY 4x using transform
        this.mesh.scale.set(4, 4, 4);
        
        console.log(`Sign created for level ${levelId} with size ${width*4}x${height*4} at position ${this.mesh.position.x}, ${this.mesh.position.y}, ${this.mesh.position.z}`);
        
        // Add to scene
        scene.add(this.mesh);
        
        // Initialize canvas and texture
        this.canvas = document.createElement('canvas');
        this.canvas.width = 2048;  // Higher resolution for the larger sign
        this.canvas.height = 2560; // Higher resolution for the larger sign
        this.context = this.canvas.getContext('2d')!;
        
        // Create texture from canvas
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        
        // Now update the mesh material with the texture
        this.mesh.material = new THREE.MeshBasicMaterial({ 
            map: this.texture,
            side: THREE.DoubleSide
        });
        
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
        
        const ctx = this.context;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Create a colorful gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#880088');   // Deep magenta at top
        gradient.addColorStop(1, '#440044');   // Darker magenta at bottom
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Add a decorative border
        ctx.strokeStyle = '#FFCC00';  // Gold border
        ctx.lineWidth = 60;
        ctx.strokeRect(60, 60, width - 120, height - 120);
        
        // Draw title with stylized text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 180px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // Add a subtle shadow to the text
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 10;
        
        // Draw the level title
        ctx.fillText(`LEVEL ${this.levelId}`, width / 2, 120);
        ctx.font = 'bold 160px Arial, sans-serif';
        ctx.fillText(`HIGHSCORES`, width / 2, 320);
        
        // Reset shadow for the rest of the text
        ctx.shadowColor = 'transparent';
        
        // Draw a decorative separator
        ctx.beginPath();
        ctx.moveTo(width * 0.1, 560);
        ctx.lineTo(width * 0.9, 560);
        ctx.strokeStyle = '#FFCC00';
        ctx.lineWidth = 20;
        ctx.stroke();
        
        // Display highscores
        if (this.highscores.length === 0) {
            // No highscores message
            ctx.font = 'bold 140px Arial, sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('No highscores yet!', width / 2, height / 2 - 200);
            ctx.font = '100px Arial, sans-serif';
            ctx.fillText('Be the first to complete', width / 2, height / 2);
            ctx.fillText('this level!', width / 2, height / 2 + 160);
        } else {
            // Draw highscores - up to 5 entries
            const startY = 660;
            const lineHeight = 320;
            const maxScores = Math.min(5, this.highscores.length);
            
            for (let i = 0; i < maxScores; i++) {
                const score = this.highscores[i];
                const y = startY + i * lineHeight;
                
                // Row background with different colors for top 3
                let bgColor = '#333333';
                if (i === 0) bgColor = '#FFD700'; // Gold
                else if (i === 1) bgColor = '#C0C0C0'; // Silver
                else if (i === 2) bgColor = '#CD7F32'; // Bronze
                
                // Background for this row
                ctx.fillStyle = bgColor;
                ctx.globalAlpha = 0.3;
                ctx.fillRect(width * 0.1, y, width * 0.8, lineHeight - 40);
                ctx.globalAlpha = 1.0;
                
                // Position & size for different elements
                const rankWidth = width * 0.1;
                const nameWidth = width * 0.4;
                const timeWidth = width * 0.3;
                const starsWidth = width * 0.1;
                
                // Rank number
                ctx.fillStyle = i < 3 ? bgColor : '#FFFFFF';
                ctx.font = 'bold 140px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${i + 1}`, width * 0.15, y + lineHeight/2 + 20);
                
                // Username
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '120px Arial, sans-serif';
                ctx.textAlign = 'left';
                
                // Truncate long usernames
                let username = score.username;
                if (username.length > 12) {
                    username = username.substring(0, 10) + '...';
                }
                
                ctx.fillText(username, width * 0.25, y + lineHeight/2 + 20);
                
                // Format time
                const minutes = Math.floor(score.timeMs / 1000 / 60);
                const seconds = Math.floor((score.timeMs / 1000) % 60);
                const milliseconds = Math.floor((score.timeMs % 1000) / 10);
                const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
                
                // Time
                ctx.textAlign = 'right';
                ctx.fillText(timeString, width * 0.75, y + lineHeight/2 + 20);
                
                // Stars
                ctx.textAlign = 'right';
                ctx.font = '100px Arial, sans-serif';
                let starsText = '';
                for (let j = 0; j < score.stars; j++) {
                    starsText += '⭐';
                }
                ctx.fillText(starsText, width * 0.9, y + lineHeight/2 + 20);
            }
        }
        
        // Force texture update
        if (this.texture) {
            this.texture.needsUpdate = true;
        }
        
        // Make sure the material is using the texture
        if (this.mesh && this.mesh.material) {
            const material = this.mesh.material as THREE.MeshBasicMaterial;
            if (material.map !== this.texture) {
                material.map = this.texture;
                material.needsUpdate = true;
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
