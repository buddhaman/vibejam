import { Game } from './Game';
import { Network } from './Network';

class GameClient {
    public game: Game;
    public network: Network;
    public localPlayerId: string;
    public input: { w: boolean; a: boolean; s: boolean; d: boolean; space: boolean; shift: boolean } = {
        w: false,
        a: false,
        s: false,
        d: false,
        space: false,
        shift: false
    };
    public lastTime: number = 0;

    constructor() {
        this.game = new Game();
        this.network = new Network(this.game);
        this.localPlayerId = 'local';
        this.animate();
    }

    public animate(): void {
        const currentTime = performance.now();
        this.lastTime = currentTime;

        // Update game with delta time
        this.game.update();

        requestAnimationFrame(() => this.animate());
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new GameClient();
}); 