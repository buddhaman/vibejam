import * as THREE from 'three';

export class SimpleText {
    private sprite: THREE.Sprite;

    constructor(
        text: string, 
        position: THREE.Vector3, 
        scene: THREE.Scene,
        textColor: string = 'white',  // Default to white text
        outlineColor: string = 'black', // Default to black outline
        fontSize: number = 48, // Default font size
        overallScale: number = 1.0  // New scale parameter
    ) {
        // Create temporary canvas to measure text dimensions
        const measuringCanvas = document.createElement('canvas');
        const measuringContext = measuringCanvas.getContext('2d')!;
        measuringContext.font = `bold ${fontSize}px Arial`;
        
        // Measure text width
        const metrics = measuringContext.measureText(text);
        const textWidth = metrics.width;
        
        // Calculate canvas dimensions with padding
        const padding = fontSize; // Padding on each side
        const canvasWidth = Math.max(512, textWidth + padding * 2); // Min width 512px
        const canvasHeight = Math.max(128, fontSize * 2 + padding); // Height based on font size
        
        // Create actual canvas and context
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Clear background (optional, for debugging)
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw text with outline
        context.textAlign = 'center';
        context.textBaseline = 'middle'; // Center text vertically
        context.font = `bold ${fontSize}px Arial`;
        
        // Calculate the vertical center with adjustment for text baseline
        const verticalCenter = canvas.height / 2;
        
        // First draw the outline
        context.strokeStyle = outlineColor;
        context.lineWidth = fontSize * 0.16; // Scale outline with font size
        context.strokeText(text, canvas.width/2, verticalCenter);
        
        // Then draw the text
        context.fillStyle = textColor;
        context.fillText(text, canvas.width/2, verticalCenter);
        
        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            depthTest: false,    // Disable depth testing
            depthWrite: false    // Don't write to depth buffer
        });
        this.sprite = new THREE.Sprite(material);
        this.sprite.position.copy(position);
        
        // Maintain aspect ratio based on canvas dimensions
        const aspectRatio = canvasWidth / canvasHeight;
        const baseScale = 5 * overallScale; // Apply overall scale factor
        this.sprite.scale.set(baseScale * aspectRatio, baseScale, 1);
        
        this.sprite.renderOrder = 999999; // Very high render order to ensure it's drawn last
        
        scene.add(this.sprite);
    }

    public remove(scene: THREE.Scene): void {
        scene.remove(this.sprite);
        
        // Clean up resources
        if (this.sprite.material instanceof THREE.SpriteMaterial) {
            if (this.sprite.material.map) {
                this.sprite.material.map.dispose();
            }
            this.sprite.material.dispose();
        }
    }
    
    // Add methods to update position if needed
    public setPosition(position: THREE.Vector3): void {
        this.sprite.position.copy(position);
    }
} 