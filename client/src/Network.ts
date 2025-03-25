import { Client, Room } from 'colyseus.js';
import { Game } from './Game';
import * as THREE from 'three';
import { Player, GameState } from '../../server/server'; // Adjust the path based on your project structure

export class Network {
    private client: Client;
    private room: Room | undefined;
    public game: Game;

    constructor(game: Game) {
        this.game = game;
        this.client = new Client('ws://localhost:3000');
        this.connect();
    }

    private async connect(): Promise<void> {
        try {
            this.room = await this.client.joinOrCreate('game_room');
            
            // Handle all state changes including player updates
            this.room.onStateChange((state: GameState) => {
                // Log all current players and their positions
                state.players.forEach((player: Player, key: string) => {
                    console.log(`Player ${key} state:`, {
                        id: player.id,
                        position: {
                            x: player.position.x,
                            y: player.position.y,
                            z: player.position.z
                        }
                    });
                });
            });

            // Register message handler for player_count
            this.room.onMessage("player_count", (message) => {
                console.log("Player count:", message.count);
            });

        } catch (error) {
            console.error("Connection error:", error);
        }
    }

    public sendPosition(position: THREE.Vector3): void {
        if (this.room) {
            this.room.send("position", {
                x: position.x,
                y: position.y,
                z: position.z
            });
        }
    }
} 