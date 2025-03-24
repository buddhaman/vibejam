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
        alpha: number
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
        
        // Create bubbles with random positions across the screen
        for (let i = 0; i < this.bubbleCount; i++) {
            // Create clusters of bubbles
            const clusterX = Math.random() * this.canvas.width;
            const clusterY = Math.random() * this.canvas.height;
            
            // Randomize bubble attributes
            const size = 10 + Math.random() * 80; // Random size between 10 and 90
            const offsetX = (Math.random() - 0.5) * size * 3;
            const offsetY = (Math.random() - 0.5) * size * 3;
            
            // Randomize color variation
            const hueVariation = Math.random() * 40 - 20; // -20 to +20 hue variation
            
            this.bubbles.push({
                x: clusterX + offsetX,
                y: clusterY + offsetY,
                radius: size,
                speed: 1 + Math.random() * 2,
                delay: Math.random() * 0.3,
                hueVariation: hueVariation,
                alpha: 0.6 + Math.random() * 0.4 // Random alpha between 0.6 and 1.0
            });
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
        
        // For transition out, invert the progress
        const effectiveProgress = this.transitionOut ? 1 - this.progress : this.progress;
        
        // Add a subtle background glow
        if (effectiveProgress > 0.05) {
            const bgGlow = Math.min(0.4, effectiveProgress * 0.5);
            this.ctx.fillStyle = `rgba(0, 180, 80, ${bgGlow})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw each bubble
        for (const bubble of this.bubbles) {
            // Calculate the current size based on progress and delay
            let bubbleProgress = Math.max(0, Math.min(1, (effectiveProgress - bubble.delay) / (1 - bubble.delay)));
            
            // Apply easing function for smoother animation (ease-in-out quad)
            if (bubbleProgress < 0.5) {
                bubbleProgress = 2 * bubbleProgress * bubbleProgress;
            } else {
                bubbleProgress = -1 + (4 - 2 * bubbleProgress) * bubbleProgress;
            }
            
            const currentRadius = bubble.radius * bubbleProgress;
            
            // Add wobble effect
            const time = performance.now() / 1000;
            const wobbleX = bubble.x + Math.sin(time * bubble.speed) * 5 * bubbleProgress;
            const wobbleY = bubble.y + Math.cos(time * bubble.speed * 0.7) * 5 * bubbleProgress;
            
            if (currentRadius > 0) {
                // Get hue variation for this bubble
                const hue = 140 + (bubble.hueVariation || 0); // Default green is ~120, going more toward 140
                
                // Create gradient for the bubble
                const gradient = this.ctx.createRadialGradient(
                    wobbleX, wobbleY, 0,
                    wobbleX, wobbleY, currentRadius
                );
                
                // Use HSL for better color control
                gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, ${bubble.alpha})`);
                gradient.addColorStop(0.7, `hsla(${hue - 10}, 90%, 40%, ${bubble.alpha * 0.7})`);
                gradient.addColorStop(1, `hsla(${hue - 20}, 80%, 30%, 0)`);
                
                // Draw the bubble
                this.ctx.beginPath();
                this.ctx.arc(wobbleX, wobbleY, currentRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = gradient;
                this.ctx.fill();
                
                // Add a highlight spot for more dimension
                const highlightSize = currentRadius * 0.3;
                const highlightX = wobbleX - currentRadius * 0.2;
                const highlightY = wobbleY - currentRadius * 0.2;
                
                const highlightGradient = this.ctx.createRadialGradient(
                    highlightX, highlightY, 0,
                    highlightX, highlightY, highlightSize
                );
                highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${bubble.alpha * 0.7})`);
                highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                this.ctx.beginPath();
                this.ctx.arc(highlightX, highlightY, highlightSize, 0, Math.PI * 2);
                this.ctx.fillStyle = highlightGradient;
                this.ctx.fill();
            }
        }
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