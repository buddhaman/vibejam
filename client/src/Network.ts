import { Client, Room } from 'colyseus.js';
import { Game } from './Game';
import * as THREE from 'three';
import { PlayerPosition, Player, GameState } from '../../shared/types';

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
    private highscores: {[levelId: string]: Array<{username: string, timeMs: number, stars: number, timestamp: number}>} = {};
    private pendingHighscoreRequests: Map<number, number> = new Map();

    constructor(game: Game) {
        this.game = game;
        
        // Automatically detect environment and use appropriate URL
        const isProduction = window.location.hostname === 'schermutseling.com';
        const wsProtocol = isProduction ? 'wss://' : 'ws://';
        const wsHost = isProduction ? 'schermutseling.com' : window.location.hostname;
        const wsPort = isProduction ? '' : ':3000'; // In production, use default port through nginx

        console.log(`${wsProtocol}${wsHost}${wsPort} production: ${isProduction}`);
        
        this.client = new Client(`${wsProtocol}${wsHost}${wsPort}/colyseus`);
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
            
            // Set up the simple notification handler
            this.setupSimpleNotificationHandler();
            
            // Setup room-specific handlers
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
        
        // Request all highscores when joining the overworld
        this.requestAllHighscores();
        
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
        
        // Register all_highscores message handler
        this.room.onMessage("all_highscores", (message) => {
            console.log("Received all highscores:");
            
            const highscores = message.highscores;
            
            // Store in our local cache
            for (const levelId in highscores) {
                this.highscores[levelId] = highscores[levelId];
            }
            
            // Update any signs in the level with the new highscores
            this.updateSignsWithHighscores();
            
            // Print to console nicely formatted
            Object.keys(highscores).sort((a, b) => parseInt(a) - parseInt(b)).forEach(levelId => {
                console.log(`\n----- Level ${levelId} Highscores -----`);
                
                if (highscores[levelId] && highscores[levelId].length > 0) {
                    highscores[levelId].forEach((entry: {username: string, timeMs: number, stars: number, timestamp: number}, index: number) => {
                        // Format time nicely
                        const minutes = Math.floor(entry.timeMs / 1000 / 60);
                        const seconds = Math.floor((entry.timeMs / 1000) % 60);
                        const milliseconds = Math.floor((entry.timeMs % 1000) / 10);
                        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
                        
                        console.log(`${index + 1}. ${entry.username} - ${timeString} (${entry.stars} ⭐)`);
                    });
                } else {
                    console.log("No highscores yet");
                }
            });
        });
    }
    
    // Connect gameplay-specific handlers (for non-overworld levels)
    private setupGameplayHandlers(): void {
        if (!this.room) return;
        
        // No need for setupNotificationSystem anymore
        
        this.room.onMessage("level_completed_by", (message) => {
            console.log(`Player ${message.username} completed level ${message.levelId} in ${message.timeMs}ms with ${message.stars} stars`);
            // Could display this in-game
        });
        
        this.room.onMessage("new_highscore", (message) => {
            console.log(`New highscore on level ${message.levelId}:`);
            console.log(`${message.username}: ${message.timeMs}ms (${message.stars} stars), position: ${message.position}`);
            
            // Show notification for the new highscore
            this.showHighscoreNotification(
                message.username, 
                message.levelId,
                message.timeMs, 
                message.position
            );
        });
        
        this.room.onMessage("level_highscores", (message) => {
            console.log(`Received highscores for level ${message.levelId}:`, message.highscores);
        });
        
        // Handle disconnection
        this.room.onLeave((code) => {
            console.log(`Left room with code: ${code}`);
            
            // If we have pending highscore requests, we'll need to reconnect and retry
            if (this.pendingHighscoreRequests.size > 0) {
                console.log(`Have ${this.pendingHighscoreRequests.size} pending highscore requests`);
            }
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
                const headPos = localPlayer.getBody().getParticles()[0].position;
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

    /**
     * Show a notification when a player achieves a new highscore
     */
    private showHighscoreNotification(username: string, levelId: number, timeMs: number, position: number): void {
        console.log(`Showing highscore notification for ${username}, position #${position}`);
        
        // Format time nicely
        const minutes = Math.floor(timeMs / 1000 / 60);
        const seconds = Math.floor((timeMs / 1000) % 60);
        const milliseconds = Math.floor((timeMs % 1000) / 10);
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
        
        // Create or get the notification element
        let notificationElement = document.getElementById('game-notification');
        if (!notificationElement) {
            notificationElement = document.createElement('div');
            notificationElement.id = 'game-notification';
            
            // Style the notification - position below timer
            Object.assign(notificationElement.style, {
                position: 'fixed',
                top: '50px', // Position below the timer
                left: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: '#ffff00', // Bright yellow for highscores
                padding: '8px 12px',
                borderRadius: '5px',
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                zIndex: '1002',
                opacity: '0',
                transition: 'opacity 0.3s',
                pointerEvents: 'none',
                maxWidth: '300px'
            });
            
            document.body.appendChild(notificationElement);
            console.log("Created notification element");
        }
        
        // Set notification text based on whether it's the player or someone else
        const isCurrentUser = username === this.game.userName;
        let message = '';
        
        if (isCurrentUser) {
            message = `🏆 You got #${position} on the leaderboard! (${timeString})`;
        } else {
            message = `🏆 ${username} got #${position} on the leaderboard! (${timeString})`;
        }
        
        // Set the notification text
        notificationElement.textContent = message;
        
        // Show the notification
        notificationElement.style.opacity = '1';
        
        console.log("Notification displayed:", message);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notificationElement) {
                notificationElement.style.opacity = '0';
                console.log("Hiding notification");
            }
        }, 5000);
    }
    
    /**
     * Get stored highscores for a level
     */
    public getHighscores(levelId: number): Array<{username: string, timeMs: number, stars: number, timestamp: number}> {
        return this.highscores[levelId.toString()] || [];
    }
    
    /**
     * Request highscores for a specific level
     * @param levelId The level ID to get highscores for
     */
    public requestHighscores(levelId: number): void {
        // This method is now disabled to prevent connection issues
        console.log("Highscore requests disabled - tracked server-side only");
        return;
    }

    // Replace setupGlobalNotificationHandler with a simpler version
    private setupSimpleNotificationHandler(): void {
        if (!this.room) return;
        
        // Listen for the single notification message type
        this.room.onMessage("notification", (data) => {
            if (typeof data === 'string') {
                // Handle plain string notifications
                console.log("NOTIFICATION:", data);
                this.showNotification(data);
            } else if (data.text) {
                // Handle object with text property for backward compatibility
                console.log("NOTIFICATION:", data.text);
                this.showNotification(data.text);
            }
        });
    }

    // Simplify the showNotification method to just handle text
    public showNotification(text: string, duration: number = 5000): void {
        console.log(`NOTIFICATION: ${text}`);
        
        // Create a completely new element each time
        const notification = document.createElement('div');
        notification.className = 'game-notification';
        
        // More elegant styling
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            left: '20px',
            backgroundColor: 'rgba(30, 30, 30, 0.85)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            zIndex: '9999',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            borderLeft: '3px solid #4a90e2',
            maxWidth: '280px',
            opacity: '0',
            transform: 'translateY(-10px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease'
        });
        
        // Set text content
        notification.textContent = text;
        
        // Add to document
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);
        
        // Remove after duration with fade-out
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-10px)';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    private showTestNotification(message: string): void {
        // Create the notification with a very obvious style
        const testNotif = document.createElement('div');
        
        // Style it to be impossible to miss
        Object.assign(testNotif.style, {
            position: 'fixed',
            top: '100px',
            left: '10px',
            backgroundColor: 'red',
            color: 'white',
            padding: '15px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            fontWeight: 'bold',
            zIndex: '10000',
            border: '3px solid white',
            borderRadius: '5px',
            boxShadow: '0 0 20px black'
        });
        
        // Set content
        testNotif.textContent = message;
        
        // Add to document
        document.body.appendChild(testNotif);
        
        console.log("Added test notification to DOM:", message);
        
        // Remove after 10 seconds
        setTimeout(() => {
            document.body.removeChild(testNotif);
        }, 10000);
    }

    // Send a notification to all players
    public sendNotification(text: string): void {
        if (!this.room || !this.playerId) return;
        
        try {
            console.log(`Sending notification: ${text}`);
            this.room.send("send_notification", { text });
        } catch (error) {
            console.error("Failed to send notification:", error);
        }
    }

    /**
     * Request all highscores for all levels
     */
    public requestAllHighscores(): void {
        if (!this.room || !this.playerId) return;
        
        try {
            console.log("Requesting all highscores");
            this.room.send("get_all_highscores");
        } catch (error) {
            console.error("Failed to request all highscores:", error);
        }
    }

    /**
     * Update signs with highscores data
     */
    public updateSignsWithHighscores(): void {
        if (!this.game.level) return;
        
        // For each sign in the level
        this.game.level.signs.forEach(sign => {
            // If we have highscores for this level ID, update the sign
            const levelIdStr = sign.getLevelId().toString();
            if (this.highscores[levelIdStr]) {
                sign.setHighscores(this.highscores[levelIdStr]);
            }
        });
    }
} 