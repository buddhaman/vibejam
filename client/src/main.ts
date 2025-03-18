import { Game } from './Game';
import { Network } from './Network';
import * as THREE from 'three';

class GameClient {
    private game: Game;
    private network: Network;
    private localPlayerId: string;
    private moveSpeed: number = 0.1;

    constructor() {
        this.game = new Game();
        this.network = new Network(this.game);
        this.localPlayerId = 'local';
        this.setupLocalPlayer();
        this.setupControls();
        this.animate();
    }

    private setupLocalPlayer(): void {
        const player = this.game.addPlayer(this.localPlayerId, true);
        player.mesh.position.set(0, 0.5, 0);
    }

    private setupControls(): void {
        document.addEventListener('keydown', (event) => {
            const player = this.game.addPlayer(this.localPlayerId);
            const position = player.mesh.position.clone();

            switch (event.key) {
                case 'w':
                    position.z -= this.moveSpeed;
                    break;
                case 's':
                    position.z += this.moveSpeed;
                    break;
                case 'a':
                    position.x -= this.moveSpeed;
                    break;
                case 'd':
                    position.x += this.moveSpeed;
                    break;
            }

            player.updatePosition(position);
            this.network.sendPosition(position);
        });
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        this.game.update();
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new GameClient();
}); 