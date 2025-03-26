import { Client, Room } from 'colyseus.js';
import { Game } from './Game';
import * as THREE from 'three';
import { Player, GameState } from '../../server/server';

// Add room type support
export enum RoomType {
  OVERWORLD = 'overworld_room',
  GAMEPLAY = 'gameplay_room'
}

export class Network {
    private client: Client;
    private room: Room | null = null;
    private game: Game;
    private updateInterval: number | null = null;
    public playerId: string | null = null;
    private currentRoomType: RoomType | null = null;

    constructor(game: Game) {
        this.game = game;
        this.client = new Client('ws://localhost:3000');
    }

    // Connect to specific room type
    public async connectToRoom(roomType: RoomType): Promise<string> {
        // If already connected to this room type, just return the ID
        if (this.room && this.currentRoomType === roomType) {
            return this.playerId!;
        }
        
        // Leave current room if connected to a different one
        if (this.room && this.currentRoomType !== roomType) {
            console.log(`Leaving ${this.currentRoomType} to join ${roomType}`);
            this.leaveCurrentRoom();
        }

        try {
            console.log(`Connecting to ${roomType}...`);
            
            // Use a timeout to ensure the promise resolves or rejects in a reasonable time
            const connectionPromise = this.client.joinOrCreate(roomType, {
                username: this.game.userName // Send username as part of the join options
            });
            
            // Set timeout for connection (5 seconds)
            const timeoutPromise = new Promise<Room>((_, reject) => {
                setTimeout(() => reject(new Error("Connection timeout")), 5000);
            });
            
            // Race between connection and timeout
            this.room = await Promise.race([connectionPromise, timeoutPromise]);
            this.playerId = this.room.sessionId;
            this.currentRoomType = roomType;
            console.log(`Connected to ${roomType} with ID: ${this.playerId}`);
            
            // Setup appropriate handlers based on room type
            if (roomType === RoomType.OVERWORLD) {
                this.setupOverworldHandlers();
            } else {
                this.setupGameplayHandlers();
            }
            
            // Start sending position updates (only matters in overworld)
            this.startSendingPosition();
            
            return this.playerId;
        } catch (error) {
            console.error(`Connection to ${roomType} failed:`, error);
            throw error;
        }
    }
    
    private leaveCurrentRoom(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.room) {
            this.room.leave();
            this.room = null;
            this.currentRoomType = null;
            console.log("Left current room");
        }
    }
    
    // Connect overworld-specific handlers
    private setupOverworldHandlers(): void {
        if (!this.room) return;
        
        this.room.onStateChange((state) => {
            if (!this.game.level) return;
            let level = this.game.level;
            
            // Handle other players in overworld (full position/state sync)
            state.players.forEach((player: Player, id: string) => {
                // Skip our ID, we manage our own player
                if (id === this.playerId) return;
                
                // Get the player's username from the state
                const username = player.username || "Unknown Player";
                
                // Handle other players
                if (!level.hasPlayer(id)) {
                    console.log(`Adding remote player: ${id} with username: ${username}`);
                    const newPlayer = level.addNetworkPlayer(id, username);
                    newPlayer.username = username;
                }
                
                // Update remote player position and username
                const remotePlayer = level.getPlayer(id);
                if (remotePlayer) {
                    // Update username if it changed
                    if (player.username && remotePlayer.username !== player.username) {
                        remotePlayer.username = player.username;
                    }
                    
                    remotePlayer.fixedHeadPosition = new THREE.Vector3(
                        player.position.x,
                        player.position.y,
                        player.position.z
                    );
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
                if (id !== this.playerId && !connectedIds.has(id)) {
                    console.log(`Removing disconnected player: ${id}`);
                    level.removePlayer(id);
                }
            });
        });
        
        // Register player count message handler
        this.room.onMessage("player_count", (message) => {
            console.log(`Connected players in overworld: ${message.count}`);
        });
    }
    
    // Connect gameplay-specific handlers (for non-overworld levels)
    private setupGameplayHandlers(): void {
        if (!this.room) return;
        
        // We don't need position updates for other players in gameplay rooms
        // Just listen for specific events like highscores
        
        this.room.onMessage("level_completed_by", (message) => {
            console.log(`Player ${message.username} completed level ${message.levelId} in ${message.timeMs}ms with ${message.stars} stars`);
            // Could display this in-game
        });
        
        this.room.onMessage("new_highscore", (message) => {
            console.log(`New highscore on level ${message.levelId}:`);
            console.log(`${message.username}: ${message.timeMs}ms (${message.stars} stars)`);
            // Could display this in-game
        });
    }
    
    // Send position updates (only matters in overworld)
    private startSendingPosition(): void {
        // Clear any existing interval
        if (this.updateInterval) clearInterval(this.updateInterval);
        
        // Make sure we have a player ID and are in the overworld room
        if (!this.playerId || this.currentRoomType !== RoomType.OVERWORLD) {
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
                    dirZ: dir.z,
                    username: this.game.userName // Include username with each position update
                });
            }
        }, 50); // 20 updates per second
    }
    
    public getRoomType(): RoomType | null {
        return this.currentRoomType;
    }
    
    // Original connectAndGetPlayerId now just connects to the appropriate room based on current level
    public async connectAndGetPlayerId(): Promise<string> {
        // Determine which room to join based on current level
        const roomType = this.game.level?.levelIdx === 0 ? 
            RoomType.OVERWORLD : RoomType.GAMEPLAY;
            
        return this.connectToRoom(roomType);
    }
    
    // Clean up all network connections
    public destroy(): void {
        this.leaveCurrentRoom();
    }

    /**
     * Disconnect from the current room
     */
    public disconnect(): void {
        this.leaveCurrentRoom();
    }

    /**
     * Send a username change to the server
     * @param username The new username
     */
    public sendUsernameChange(username: string): void {
        if (!this.room || !this.playerId) return;
        
        try {
            this.room.send("username_change", { username });
            console.log(`Sent username update: ${username}`);
        } catch (error) {
            console.error("Failed to send username update:", error);
        }
    }

    /**
     * Send level completion data to the server
     * @param levelId The level ID that was completed
     * @param timeMs Time taken to complete the level in milliseconds
     * @param stars Number of stars earned (optional)
     */
    public sendLevelCompletion(levelId: number, timeMs: number, stars: number = 0): void {
        if (!this.room || !this.playerId) return;
        
        try {
            this.room.send("level_complete", {
                levelId,
                timeMs,
                stars
            });
            console.log(`Sent level completion: Level ${levelId} in ${timeMs}ms with ${stars} stars`);
        } catch (error) {
            console.error("Failed to send level completion:", error);
        }
    }
} 