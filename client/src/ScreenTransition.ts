import * as THREE from 'three';

/**
 * Class that provides a screen transition effect with green bubbles
 * This class works independently of the 3D scene and renders a 2D overlay
 */
export class ScreenTransition {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private transitionIn: boolean = false;
    private transitionOut: boolean = false;
    private progress: number = 0;
    private callback: (() => void) | null = null;
    private bubbles: Array<{
        x: number,
        y: number,
        radius: number,
        speed: number,
        delay: number,
        hueVariation?: number,
        alpha: number,
        greenValue?: number
    }> = [];
    private readonly bubbleCount = 100;
    private animationId: number | null = null;
    
    constructor() {
        // Create canvas element for the transition effect
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '10000'; // Above everything
        this.canvas.style.pointerEvents = 'none'; // Don't block interactions
        this.canvas.style.display = 'none'; // Hidden by default
        
        // Get context for drawing
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context for transition canvas');
        this.ctx = ctx;
        
        // Add canvas to document
        document.body.appendChild(this.canvas);
        
        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));
        this.handleResize();
        
        // Initialize bubbles
        this.initBubbles();
    }
    
    /**
     * Handle canvas resize
     */
    private handleResize(): void {
        // Make the canvas match the window size in pixels
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Re-initialize bubbles when resizing
        this.initBubbles();
    }
    
    /**
     * Initialize bubble positions
     */
    private initBubbles(): void {
        this.bubbles = [];
        
        // Create bubbles to cover the entire screen with more uniform distribution
        const gridSize = Math.ceil(Math.sqrt(this.bubbleCount));
        const cellWidth = this.canvas.width / gridSize;
        const cellHeight = this.canvas.height / gridSize;
        
        let index = 0;
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                if (index >= this.bubbleCount) break;
                
                // Calculate position with some randomness within each cell
                const x = col * cellWidth + cellWidth * (0.3 + Math.random() * 0.4); // 30-70% of cell width
                const y = row * cellHeight + cellHeight * (0.3 + Math.random() * 0.4); // 30-70% of cell height
                
                // Make bubbles larger to ensure coverage
                const size = Math.max(cellWidth, cellHeight) * (1.0 + Math.random() * 0.5);
                
                // Simple green color variation
                const greenValue = 120 + Math.floor(Math.random() * 80); // 120-200 green value
                
                // Left to right appearance based on x-position
                const delay = (x / this.canvas.width) * 0.5; // 0-0.5 seconds delay based on x position
                
                this.bubbles.push({
                    x: x,
                    y: y,
                    radius: size,
                    speed: 1 + Math.random() * 0.5, // Less speed variation for more uniform look
                    delay: delay,
                    hueVariation: 0, // We'll use fixed green values instead
                    alpha: 0.8 + Math.random() * 0.2, // High alpha for more solid look
                    greenValue: greenValue
                });
                
                index++;
            }
        }
    }
    
    /**
     * Start transition in (closing)
     * @param callback Optional callback to run when transition completes
     */
    public transitionInStart(callback?: () => void): void {
        if (this.transitionIn || this.transitionOut) return; // Already transitioning
        
        this.transitionIn = true;
        this.transitionOut = false;
        this.progress = 0;
        this.callback = callback || null;
        this.canvas.style.display = 'block';
        
        if (this.animationId === null) {
            this.animate();
        }
    }
    
    /**
     * Start transition out (opening)
     * @param callback Optional callback to run when transition completes
     */
    public transitionOutStart(callback?: () => void): void {
        if (this.transitionIn || this.transitionOut) return; // Already transitioning
        
        this.transitionIn = false;
        this.transitionOut = true;
        this.progress = 0;
        this.callback = callback || null;
        this.canvas.style.display = 'block';
        
        if (this.animationId === null) {
            this.animate();
        }
    }
    
    /**
     * Animation loop
     */
    private animate(): void {
        this.animationId = requestAnimationFrame(this.animate.bind(this));
        
        // Update transition progress
        if (this.transitionIn || this.transitionOut) {
            this.progress += 0.02; // Adjust speed as needed
            
            // Check if transition is complete
            if (this.progress >= 1) {
                if (this.transitionIn) {
                    // When transition in completes, hold for a moment before calling callback
                    this.transitionIn = false;
                    
                    if (this.callback) {
                        const cb = this.callback;
                        this.callback = null;
                        setTimeout(() => {
                            cb();
                            // Automatically start transition out after callback
                            this.transitionOutStart();
                        }, 300);
                    } else {
                        // No callback, just transition out
                        setTimeout(() => {
                            this.transitionOutStart();
                        }, 300);
                    }
                } else if (this.transitionOut) {
                    // When transition out completes, stop animation and hide canvas
                    this.transitionOut = false;
                    this.canvas.style.display = 'none';
                    
                    if (this.animationId !== null) {
                        cancelAnimationFrame(this.animationId);
                        this.animationId = null;
                    }
                    
                    if (this.callback) {
                        const cb = this.callback;
                        this.callback = null;
                        cb();
                    }
                }
            }
        }
        
        this.draw();
    }
    
    /**
     * Draw the current frame of the transition
     */
    private draw(): void {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Base progress calculation
        const baseProgress = this.transitionOut ? 1 - this.progress : this.progress;
        
        // Add a subtle background glow
        if (baseProgress > 0.05) {
            const bgGlow = Math.min(0.5, baseProgress * 0.6);
            this.ctx.fillStyle = `rgba(0, 160, 70, ${bgGlow})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw each bubble
        for (const bubble of this.bubbles) {
            // Calculate the current size based on progress and delay
            let bubbleProgress;
            
            if (this.transitionOut) {
                // Use a reversed x-position for transition out
                // This makes bubbles on the left side disappear first
                const normalizedXPos = 1 - (bubble.x / this.canvas.width); // REVERSED here
                const outDelay = normalizedXPos * 0.7;
                
                bubbleProgress = Math.max(0, Math.min(1, (baseProgress - outDelay) / (1 - outDelay)));
            } else {
                // For transition in: left bubbles appear first (same as before)
                const normalizedXPos = bubble.x / this.canvas.width;
                const inDelay = normalizedXPos * 0.7;
                bubbleProgress = Math.max(0, Math.min(1, (baseProgress - inDelay) / (1 - inDelay)));
            }
            
            // Apply easing function for smoother animation
            bubbleProgress = this.easeInOutQuad(bubbleProgress);
            
            const currentRadius = bubble.radius * bubbleProgress;
            
            if (currentRadius > 0) {
                // Use flat color with slight variations in green
                const green = bubble.greenValue || 160;
                this.ctx.fillStyle = `rgba(0, ${green}, 80, ${bubble.alpha})`;
                
                // Draw the bubble as a flat circle
                this.ctx.beginPath();
                this.ctx.arc(bubble.x, bubble.y, currentRadius, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Add a subtle lighter edge for some dimension without using gradients
                this.ctx.strokeStyle = `rgba(100, ${green + 30}, 120, ${bubble.alpha * 0.5})`;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        }
    }
    
    // Helper function for smooth animation
    private easeInOutQuad(t: number): number {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    /**
     * Clean up resources
     */
    public destroy(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        window.removeEventListener('resize', this.handleResize.bind(this));
        
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
} 