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
        
        // Create a simple colored plane
        const signGeometry = new THREE.PlaneGeometry(width, height);
        
        // Create a simple colored material that will work for sure
        const signMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff, // White base color
            side: THREE.DoubleSide
        });
        
        // Use simple mesh with a single material
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
            
            // Column headers
            ctx.fillStyle = '#FFCC00';
            ctx.font = 'bold 90px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('RANK', width * 0.15, startY - 100);
            ctx.textAlign = 'left';
            ctx.fillText('PLAYER', width * 0.25, startY - 100);
            ctx.textAlign = 'center';
            ctx.fillText('TIME', width * 0.65, startY - 100);
            ctx.fillText('⭐', width * 0.88, startY - 100);
            
            for (let i = 0; i < maxScores; i++) {
                const score = this.highscores[i];
                const y = startY + i * lineHeight;
                
                // Row background with different colors for top 3
                let bgColor = '#333333';
                if (i === 0) bgColor = '#FFD700'; // Gold
                else if (i === 1) bgColor = '#C0C0C0'; // Silver
                else if (i === 2) bgColor = '#CD7F32'; // Bronze
                
                // Background for this row with slight rounding of corners
                ctx.fillStyle = bgColor;
                ctx.globalAlpha = 0.3;
                
                // Draw rounded rectangle
                const rectX = width * 0.1;
                const rectY = y;
                const rectWidth = width * 0.8;
                const rectHeight = lineHeight - 40;
                const cornerRadius = 30;
                
                ctx.beginPath();
                ctx.moveTo(rectX + cornerRadius, rectY);
                ctx.lineTo(rectX + rectWidth - cornerRadius, rectY);
                ctx.arcTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + cornerRadius, cornerRadius);
                ctx.lineTo(rectX + rectWidth, rectY + rectHeight - cornerRadius);
                ctx.arcTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - cornerRadius, rectY + rectHeight, cornerRadius);
                ctx.lineTo(rectX + cornerRadius, rectY + rectHeight);
                ctx.arcTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - cornerRadius, cornerRadius);
                ctx.lineTo(rectX, rectY + cornerRadius);
                ctx.arcTo(rectX, rectY, rectX + cornerRadius, rectY, cornerRadius);
                ctx.closePath();
                ctx.fill();
                
                ctx.globalAlpha = 1.0;
                
                // Draw rank circle
                const rankX = width * 0.15;
                const rankY = y + lineHeight/2;
                const rankRadius = 70;
                
                ctx.fillStyle = i < 3 ? bgColor : '#555555';
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.arc(rankX, rankY, rankRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
                
                // Rank number - centered in circle
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 120px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${i + 1}`, rankX, rankY);
                
                // Username at top of entry
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '100px Arial, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                
                // Truncate long usernames
                let username = score.username;
                if (username.length > 15) {
                    username = username.substring(0, 13) + '...';
                }
                
                ctx.fillText(username, width * 0.25, y + 40);
                
                // Format time
                const minutes = Math.floor(score.timeMs / 1000 / 60);
                const seconds = Math.floor((score.timeMs / 1000) % 60);
                const milliseconds = Math.floor((score.timeMs % 1000) / 10);
                const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
                
                // Time at bottom of entry
                ctx.textAlign = 'center';
                ctx.font = 'bold 110px Arial, sans-serif';
                ctx.fillText(timeString, width * 0.65, y + lineHeight - 120);
                
                // Stars on right side, vertically centered
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '100px Arial, sans-serif';
                let starsText = '';
                for (let j = 0; j < score.stars; j++) {
                    starsText += '⭐';
                }
                ctx.fillText(starsText, width * 0.88, y + lineHeight/2);
            }
        }
        
        // Force texture update
        if (this.texture) {
            this.texture.needsUpdate = true;
        }
        
        // Update the material texture
        if (this.mesh && Array.isArray(this.mesh.material)) {
            const frontMaterial = this.mesh.material[0] as THREE.MeshBasicMaterial;
            if (frontMaterial.map !== this.texture) {
                frontMaterial.map = this.texture;
                frontMaterial.needsUpdate = true;
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
