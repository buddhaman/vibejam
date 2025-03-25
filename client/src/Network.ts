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
            
            // Handle state changes
            this.room.onStateChange((state: GameState) => {
                // Track all players in the game state
                const currentPlayers = new Set<string>();
                
                state.players.forEach((player: Player, key: string) => {
                    currentPlayers.add(key);
                    
                    // Add new players that don't exist yet
                    if (!this.game.hasPlayer(key)) {
                        this.game.addNetworkPlayer(key);
                    }
                    
                    // Update existing player positions
                    const gamePlayer = this.game.getPlayer(key);
                    if (gamePlayer) {
                        const position = new THREE.Vector3(
                            player.position.x,
                            player.position.y,
                            player.position.z
                        );
                        gamePlayer.setPosition(position);
                    }
                    
                    console.log(`Player ${key} position:`, {
                        id: player.id,
                        position: {
                            x: player.position.x,
                            y: player.position.y,
                            z: player.position.z
                        }
                    });
                });
                
                // Remove players that are no longer in the state
                this.game.getPlayerIds().forEach(playerId => {
                    if (playerId !== this.game.getLocalPlayerId() && !currentPlayers.has(playerId)) {
                        this.game.removePlayer(playerId);
                    }
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