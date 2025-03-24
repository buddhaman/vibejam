import * as THREE from 'three';

export class SimpleText {
    private sprite: THREE.Sprite;

    constructor(
        text: string, 
        position: THREE.Vector3, 
        scene: THREE.Scene,
        textColor: string = 'black',
        outlineColor: string = 'black',  // Kept for backward compatibility but unused
        fontSize: number = 24,  // Reduced default font size
        overallScale: number = 0.5  // Reduced scale factor
    ) {
        // Use higher resolution for the actual rendering
        const resolutionScale = 6;  // Higher resolution for crisper text
        const actualFontSize = fontSize * resolutionScale;
        
        // Create temporary canvas to measure text dimensions
        const measuringCanvas = document.createElement('canvas');
        const measuringContext = measuringCanvas.getContext('2d')!;
        measuringContext.font = `${actualFontSize}px "Comic Sans MS", cursive`;
        
        // Measure text width at high resolution
        const metrics = measuringContext.measureText(text);
        const textWidth = metrics.width;
        
        // Calculate canvas dimensions with minimal padding at high resolution
        const padding = actualFontSize * 0.5;
        const canvasWidth = textWidth + padding * 2;
        const canvasHeight = actualFontSize * 1.4 + padding;
        
        // Create actual canvas and context at high resolution
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Enable text rendering optimizations
        context.textRendering = 'optimizeLegibility';
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        // Clear background
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set up text style
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `${actualFontSize}px "Comic Sans MS", cursive`;
        
        // Draw the text - clean and simple
        context.fillStyle = textColor;
        context.fillText(text, canvas.width/2, canvas.height/2);
        
        // Create sprite with crisp texture settings
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            sizeAttenuation: true
        });
        
        this.sprite = new THREE.Sprite(material);
        this.sprite.position.copy(position);
        
        // Scale appropriately - divide by resolution scale to maintain same world size
        const aspectRatio = canvasWidth / canvasHeight;
        const baseScale = (2.0 * overallScale) / resolutionScale;
        this.sprite.scale.set(baseScale * aspectRatio, baseScale, 1);
        
        this.sprite.renderOrder = 999999;
        
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