import { Game } from './Game';
import { Network } from './Network';
import * as THREE from 'three';

class GameClient {
    private game: Game;
    private network: Network;
    private localPlayerId: string;
    private input: { w: boolean; a: boolean; s: boolean; d: boolean } = {
        w: false,
        a: false,
        s: false,
        d: false
    };
    private lastTime: number = 0;

    constructor() {
        this.game = new Game();
        this.network = new Network(this.game);
        this.localPlayerId = 'local';
        this.setupLocalPlayer();
        this.setupControls();
        this.animate();
    }

    private setupLocalPlayer(): void {
        this.game.addPlayer(this.localPlayerId, true);
    }

    private setupControls(): void {
        document.addEventListener('keydown', (event) => {
            switch (event.key.toLowerCase()) {
                case 'w': this.input.w = true; break;
                case 's': this.input.s = true; break;
                case 'a': this.input.a = true; break;
                case 'd': this.input.d = true; break;
            }
        });

        document.addEventListener('keyup', (event) => {
            switch (event.key.toLowerCase()) {
                case 'w': this.input.w = false; break;
                case 's': this.input.s = false; break;
                case 'a': this.input.a = false; break;
                case 'd': this.input.d = false; break;
            }
        });
    }

    private animate(): void {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Update game with delta time
        this.game.update(deltaTime);

        // Handle input for local player
        const player = this.game.getPlayer(this.localPlayerId);
        if (player) {
            player.handleInput(this.input);
        }

        requestAnimationFrame(() => this.animate());
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new GameClient();
}); 