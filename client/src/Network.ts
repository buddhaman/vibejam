import { Client, Room } from 'colyseus.js';
import { Game } from './Game';
import * as THREE from 'three';
import { Player, GameState } from '../../server/server';

export class Network {
    private client: Client;
    private room: Room | null = null;
    private game: Game;
    private updateInterval: number | null = null;
    public playerId: string | null = null;

    constructor(game: Game) {
        this.game = game;
        this.client = new Client('ws://localhost:3000');
    }

    // Connect and get player ID
    public async connectAndGetPlayerId(): Promise<string> {
        try {
            console.log("Connecting to server...");
            this.room = await this.client.joinOrCreate('game_room');
            this.playerId = this.room.sessionId;
            console.log(`Got player ID: ${this.playerId}`);
            
            // Setup state change handler
            this.room.onStateChange((state) => {
                if (!this.game.level) return;
                let level = this.game.level;
                
                // Only care about remote players
                state.players.forEach((player: Player, id: string) => {
                    // Skip our ID, we manage our own player
                    if (id === this.playerId) return;
                    
                    // Handle other players
                    if (!level.hasPlayer(id)) {
                        console.log(`Adding remote player: ${id}`);
                        level.addNetworkPlayer(id);
                    }
                    
                    // Update position
                    const remotePlayer = level.getPlayer(id);
                    if (remotePlayer) {
                        remotePlayer.fixedHeadPosition = new THREE.Vector3(
                            player.position.x,
                            player.position.y,
                            player.position.z
                        );
                        // Update direction
                        remotePlayer.lastMovementDir.set(
                            player.position.dirX,
                            player.position.dirY,
                            player.position.dirZ
                        );
                    }
                });
                
                // Remove disconnected players
                const connectedIds = new Set(Array.from(state.players.keys()));
                level.getNetworkPlayerIds().forEach(id => {
                    // If a player is in our level but not in the state, they've disconnected
                    if (id !== this.playerId && !connectedIds.has(id)) {
                        console.log(`Removing disconnected player: ${id}`);
                        level.removePlayer(id);
                    }
                });
            });
            
            // Register handler for player count messages
            this.room.onMessage("player_count", (message) => {
                console.log(`Connected players: ${message.count}`);
            });
            
            // Start update loop
            this.startSendingPosition();
            
            return this.playerId;
        } catch (error) {
            console.error("Connection error:", error);
            throw error;
        }
    }
    
    // Send position updates
    private startSendingPosition(): void {
        // Clear any existing interval
        if (this.updateInterval) clearInterval(this.updateInterval);
        
        // Make sure we have a player ID
        if (!this.playerId) {
            console.error("Cannot send position updates: No player ID");
            return;
        }
        
        // Create new interval
        this.updateInterval = window.setInterval(() => {
            if (!this.room || !this.game.level) return;
            
            const localPlayer = this.game.level.getPlayer(this.playerId!);
            if (localPlayer) {
                // Get head position (first particle) instead of average
                const headPos = localPlayer.verletBody.getParticles()[0].position;
                const dir = localPlayer.lastMovementDir;
                this.room.send("position", {
                    x: headPos.x,
                    y: headPos.y,
                    z: headPos.z,
                    dirX: dir.x,
                    dirY: dir.y,
                    dirZ: dir.z
                });
            }
        }, 50); // 20 updates per second
    }
    
    // Clean up
    public destroy(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.room) {
            this.room.leave();
            this.room = null;
        }
    }
} 