import * as THREE from 'three';

export class SimpleText {
    private sprite!: THREE.Sprite;
    private currentText: string = "";
    private textColor: string;
    private outlineColor: string;
    private fontSize: number;
    private overallScale: number;

    constructor(
        text: string, 
        position: THREE.Vector3, 
        scene: THREE.Scene,
        textColor: string = 'black',
        outlineColor: string = 'black',  // Color for the text outline
        fontSize: number = 48,  // Increased font size (1.5x from 32)
        overallScale: number = 1.5  // Increased scale factor (1.5x from 1.0)
    ) {
        this.currentText = text;
        this.textColor = textColor;
        this.outlineColor = outlineColor;
        this.fontSize = fontSize;
        this.overallScale = overallScale;
        
        this.createTextSprite(text, position);
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

    /**
     * Update the text content
     * @param newText The new text to display
     */
    public updateText(newText: string): void {
        // If text hasn't changed, don't recreate
        if (this.currentText === newText) return;
        
        // Store current position
        const position = this.sprite.position.clone();
        
        // Remove existing sprite
        if (this.sprite.parent) {
            this.sprite.parent.remove(this.sprite);
        }
        
        // Clean up resources
        if (this.sprite.material instanceof THREE.SpriteMaterial) {
            if (this.sprite.material.map) {
                this.sprite.material.map.dispose();
            }
            this.sprite.material.dispose();
        }
        
        // Create new text with same parameters
        this.createTextSprite(newText, position);
        
        // Store current text
        this.currentText = newText;
    }

    // Move sprite creation to a separate method
    private createTextSprite(text: string, position: THREE.Vector3): void {
        // Use higher resolution for the actual rendering
        const resolutionScale = 6;  // Higher resolution for crisper text
        const actualFontSize = this.fontSize * resolutionScale;
        
        // Font family with fallbacks
        const fontFamily = '"Comic Sans MS", "Chalkboard SE", "Marker Felt", "Short Stack", cursive';
        
        // Create temporary canvas to measure text dimensions
        const measuringCanvas = document.createElement('canvas');
        const measuringContext = measuringCanvas.getContext('2d')!;
        measuringContext.font = `${actualFontSize}px ${fontFamily}`;
        
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
        context.font = `${actualFontSize}px ${fontFamily}`;
        
        // Draw the text outline
        context.strokeStyle = this.outlineColor;
        context.lineWidth = actualFontSize * 0.1; // Outline thickness proportional to font size
        context.lineJoin = 'round';
        context.strokeText(text, canvas.width/2, canvas.height/2);
        
        // Draw the text fill
        context.fillStyle = this.textColor;
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
        const baseScale = (3.0 * this.overallScale) / resolutionScale;  // Increased base scale
        this.sprite.scale.set(baseScale * aspectRatio, baseScale, 1);
        
        this.sprite.renderOrder = 999999;
    }
} 