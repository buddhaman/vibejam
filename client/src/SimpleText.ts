import * as THREE from 'three';

export class SimpleText {
    private sprite: THREE.Sprite;

    constructor(
        text: string, 
        position: THREE.Vector3, 
        scene: THREE.Scene,
        textColor: string = 'white',  // Default to white text
        outlineColor: string = 'black' // Default to black outline
    ) {
        // Create canvas and context
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 512;  // Wide enough for text
        canvas.height = 128;

        // Draw text with outline
        context.textAlign = 'center';
        context.font = 'bold 48px Arial';
        
        // First draw the outline
        context.strokeStyle = outlineColor;
        context.lineWidth = 8;
        context.strokeText(text, canvas.width/2, canvas.height/2);
        
        // Then draw the text
        context.fillStyle = textColor;
        context.fillText(text, canvas.width/2, canvas.height/2);

        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        this.sprite = new THREE.Sprite(material);
        this.sprite.position.copy(position);
        this.sprite.scale.set(10, 2.5, 1);

        scene.add(this.sprite);
    }

    public remove(scene: THREE.Scene): void {
        scene.remove(this.sprite);
    }
} 