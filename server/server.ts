import express from 'express';
import { createServer } from 'http';
import { Server, Room, Client } from 'colyseus';
import { Schema, type, MapSchema } from "@colyseus/schema";
import fs from 'fs';
import path from 'path';
import { GlobalDispatcher } from './GlobalDispatcher';

// Define room types enum to match client-side definition
enum RoomType {
  OVERWORLD = "overworld_room",
  GAMEPLAY = "gameplay_room"
}

// Define our schema
export class PlayerPosition extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
  @type("number") dirX: number = 0;
  @type("number") dirY: number = 0;
  @type("number") dirZ: number = 1;  // Default forward direction
}

export class Player extends Schema {
  @type("string") id: string;
  @type("string") username: string = "Unknown Player";
  @type(PlayerPosition) position = new PlayerPosition();

  constructor(id: string, username: string = "Unknown Player") {
    super();
    this.id = id;
    this.username = username;
  }
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

// To store level completion data
interface LevelCompletion {
  playerId: string;
  username: string;
  levelId: number;
  timeMs: number;
  stars: number;
  timestamp: number;
}

// Interface for highscore entry
interface HighscoreEntry {
  username: string;
  timeMs: number;
  stars: number;
  timestamp: number;
}

// Interface for highscores by level
interface Highscores {
  [levelId: string]: HighscoreEntry[];
}

// Create our room
class GameRoom extends Room<GameState> {
  // Store level completions
  private levelCompletions: LevelCompletion[] = [];
  // Path to highscores file - using an absolute path to ensure consistency
  private highscoresPath = path.resolve(__dirname, '../data/highscores.json');
  // In-memory highscores cache
  private highscores: {[levelId: string]: Array<{username: string, timeMs: number, stars: number, timestamp: number}>} = {};

  onCreate() {
    this.state = new GameState();
    console.log(`Game room created! Room ID: ${this.roomId}`);
    
    // Register with the GlobalDispatcher
    GlobalDispatcher.register(this);
    
    // Make sure the data directory exists
    this.ensureDataDirectoryExists();
    
    // Load existing highscores
    this.loadHighscores();

    // Handle position updates
    this.onMessage("position", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && data.x !== undefined && data.y !== undefined && data.z !== undefined) {
        player.position.x = data.x;
        player.position.y = data.y;
        player.position.z = data.z;
        player.position.dirX = data.dirX;
        player.position.dirY = data.dirY;
        player.position.dirZ = data.dirZ;
        
        // Update username if included and changed
        if (data.username && player.username !== data.username) {
          player.username = data.username;
          console.log(`Player ${client.sessionId} username updated to: ${data.username}`);
        }
      }
    });

    // Handle username changes
    this.onMessage("username_change", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && data.username) {
        player.username = data.username;
        console.log(`Player ${client.sessionId} changed username to: ${data.username}`);
      }
    });

    // Handle level completions with GlobalDispatcher
    this.onMessage("level_complete", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && data.levelId !== undefined && data.timeMs !== undefined) {
        console.log(`Player ${player.username} completed level ${data.levelId} in ${data.timeMs}ms with ${data.stars || 0} stars`);
        
        // Format a simple completion message
        const formattedTime = (data.timeMs / 1000).toFixed(2);
        const completionText = `${player.username} completed level ${data.levelId} in ${formattedTime}s with ${data.stars || 0} stars!`;
        console.log(`Broadcasting notification: ${completionText}`);
        
        // Always broadcast ANY level completion as a simple text notification
        GlobalDispatcher.broadcast("broadcast", completionText);
        
        // Create the completion data for highscore checking
        const completionData = {
          username: player.username,
          levelId: data.levelId,
          timeMs: data.timeMs,
          stars: data.stars || 0
        };
        
        // Check for highscore separately
        const highscoreResult = this.addHighscore(data.levelId, {
          username: player.username,
          timeMs: data.timeMs,
          stars: data.stars || 0,
          timestamp: Date.now()
        });
        
        // If it's a highscore, broadcast that as a special notification too
        if (highscoreResult.isTopTen) {
          const position = highscoreResult.position;
          console.log(`HIGHSCORE: ${player.username} got position #${position} on level ${data.levelId}`);
          
          const highscoreText = `🏆 ${player.username} got position #${position} on level ${data.levelId} leaderboard!`;
          console.log(`Broadcasting highscore notification: ${highscoreText}`);
          
          // Broadcast highscore as a simple text notification
          GlobalDispatcher.broadcast("broadcast", highscoreText);
        }
      }
    });
    
    // Register get_highscores handler
    this.onMessage("get_highscores", (client, data) => {
      console.log(`Player ${client.sessionId} requested highscores for level ${data.levelId}`);
      
      if (data.levelId !== undefined) {
        const levelHighscores = this.getHighscores(data.levelId);
        console.log(`Sending ${levelHighscores.length} highscores for level ${data.levelId}`);
        
        client.send("level_highscores", {
          levelId: data.levelId,
          highscores: levelHighscores
        });
      }
    });

    // Add a handler to get ALL highscores (top 5 per level)
    this.onMessage("get_all_highscores", (client) => {
      console.log(`Player ${client.sessionId} requested all highscores`);
      
      const allHighscores: {[levelId: string]: Array<{username: string, timeMs: number, stars: number, timestamp: number}>} = {};
      
      // Get top 5 for each level
      Object.keys(this.highscores).forEach(levelId => {
        allHighscores[levelId] = this.highscores[levelId].slice(0, 5);
      });
      
      console.log(`Sending highscores for ${Object.keys(allHighscores).length} levels`);
      
      client.send("all_highscores", {
        highscores: allHighscores
      });
    });

    // Add global notification handler with GlobalDispatcher
    this.onMessage("send_global_notification", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && data.text) {
        console.log(`Global notification from ${player.username}: ${data.text}`);
        
        // Broadcast simple text message to all rooms using GlobalDispatcher
        GlobalDispatcher.broadcast("broadcast", data.text);
      }
    });

    // Simplify to a basic text-only notification system with better logging
    this.presence.subscribe("broadcast", (message: string) => {
      console.log(`[${this.roomId}] ⭐⭐⭐ Broadcasting notification to all clients: "${message}"`);
      // Forward the simple text message to all clients in this room
      this.broadcast("notification", message);
    });
  }

  onJoin(client: Client, options: any) {
    console.log(`Player ${client.sessionId} joined`);
    
    // Get username from options if provided
    const username = options?.username || "Unknown Player";
    
    // Create new player with username
    this.state.players.set(client.sessionId, new Player(client.sessionId, username));
    console.log(`Player ${client.sessionId} joined with username: ${username}`);
    
    // Broadcast player count
    this.broadcast("player_count", { count: this.state.players.size });
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    const username = player ? player.username : "Unknown Player";
    
    console.log(`Player ${username} (${client.sessionId}) left`);
    this.state.players.delete(client.sessionId);
    
    // Broadcast player count
    this.broadcast("player_count", { count: this.state.players.size });
  }
  
  onDispose() {
    // Unregister from GlobalDispatcher when room is disposed
    GlobalDispatcher.unregister(this);
    console.log(`Game room disposed: ${this.roomId}`);
  }
  
  // Ensure the data directory exists
  private ensureDataDirectoryExists(): void {
    const dataDir = path.dirname(this.highscoresPath);
    console.log(`Ensuring data directory exists: ${dataDir}`);
    
    try {
      if (!fs.existsSync(dataDir)) {
        console.log(`Creating data directory: ${dataDir}`);
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (error) {
      console.error(`Failed to create data directory: ${dataDir}`, error);
    }
  }
  
  // Load highscores from disk with improved logging
  private loadHighscores(): void {
    console.log(`Loading highscores from: ${this.highscoresPath}`);
    
    try {
      if (fs.existsSync(this.highscoresPath)) {
        const data = fs.readFileSync(this.highscoresPath, 'utf8');
        this.highscores = JSON.parse(data);
        
        // Count total highscores
        let totalEntries = 0;
        let totalLevels = 0;
        
        Object.keys(this.highscores).forEach(levelId => {
          if (this.highscores[levelId] && this.highscores[levelId].length > 0) {
            totalLevels++;
            totalEntries += this.highscores[levelId].length;
          }
        });
        
        console.log(`✅ Highscores loaded from disk: ${totalEntries} entries across ${totalLevels} levels`);
        
        // Log a summary of the highscores
        Object.keys(this.highscores).sort((a, b) => parseInt(a) - parseInt(b)).forEach(levelId => {
          const scores = this.highscores[levelId];
          if (scores && scores.length > 0) {
            console.log(`- Level ${levelId}: ${scores.length} entries, top score: ${scores[0].username} (${scores[0].timeMs}ms)`);
          }
        });
      } else {
        this.highscores = {};
        console.log(`⚠️ No highscores file found at ${this.highscoresPath}, starting with empty highscores`);
      }
    } catch (error) {
      console.error(`❌ Error loading highscores from ${this.highscoresPath}:`, error);
      this.highscores = {};
    }
  }
  
  // Save highscores to disk with improved error handling
  private saveHighscores(): void {
    console.log(`Saving highscores to: ${this.highscoresPath}`);
    
    try {
      // Ensure directory exists
      this.ensureDataDirectoryExists();
      
      // Create JSON string
      const data = JSON.stringify(this.highscores, null, 2);
      
      // Save to a temp file first to avoid nodemon restart
      const tempFile = `${this.highscoresPath}.tmp`;
      
      // Write to temp file
      fs.writeFileSync(tempFile, data, 'utf8');
      
      // Then rename (atomic operation) to avoid nodemon watching the write
      fs.renameSync(tempFile, this.highscoresPath);
      
      // Count total highscores for logging
      let totalEntries = 0;
      Object.values(this.highscores).forEach(scores => {
        totalEntries += scores.length;
      });
      
      console.log(`✅ Highscores saved to ${this.highscoresPath} (${totalEntries} total entries)`);
      
      // Log file stats to confirm it was saved
      const stats = fs.statSync(this.highscoresPath);
      console.log(`File size: ${stats.size} bytes, Last modified: ${stats.mtime}`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`❌ Error saving highscores: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
      } else {
        console.error('❌ Error saving highscores: Unknown error type');
      }
    }
  }
  
  // Update the addHighscore method with detailed logging
  private addHighscore(levelId: number, entry: {username: string, timeMs: number, stars: number, timestamp: number}): {isTopTen: boolean, position: number} {
    const levelIdStr = levelId.toString();
    
    // Format time for better readability in logs
    const formattedTime = this.formatTime(entry.timeMs);
    
    console.log(`\n==== HIGHSCORE CHECK ====`);
    console.log(`Player: ${entry.username}`);
    console.log(`Level: ${levelId}`);
    console.log(`Time: ${formattedTime} (${entry.timeMs}ms)`);
    console.log(`Stars: ${entry.stars}⭐`);
    
    // Initialize array for this level if it doesn't exist
    if (!this.highscores[levelIdStr]) {
      this.highscores[levelIdStr] = [];
      console.log(`This is the first score ever for level ${levelId}!`);
    }
    
    // Get current highscores for this level
    const levelScores = [...this.highscores[levelIdStr]]; // Clone array
    
    // Log current top scores before adding new one
    if (levelScores.length > 0) {
      console.log(`\nCurrent top scores for Level ${levelId}:`);
      levelScores.slice(0, Math.min(5, levelScores.length)).forEach((score, idx) => {
        console.log(`  #${idx+1}: ${score.username} - ${this.formatTime(score.timeMs)} (${score.stars}⭐)`);
      });
    } else {
      console.log(`No existing scores for Level ${levelId}`);
    }
    
    // Add the new score
    levelScores.push(entry);
    
    // Sort by time (fastest first)
    levelScores.sort((a, b) => a.timeMs - b.timeMs);
    
    // Find position (1-based)
    let position = 0;
    for (let i = 0; i < levelScores.length; i++) {
      if (levelScores[i].timeMs === entry.timeMs && 
          levelScores[i].username === entry.username &&
          levelScores[i].timestamp === entry.timestamp) {
        position = i + 1;
        break;
      }
    }
    
    // Check if it's in the top 10
    const isTopTen = position <= 10;
    
    if (isTopTen) {
      // Keep only top 10
      this.highscores[levelIdStr] = levelScores.slice(0, 10);
      
      console.log(`\n🏆 HIGHSCORE ACHIEVED! 🏆`);
      console.log(`Position: #${position} of ${levelScores.length} times`);
      
      // Log updated top 5
      console.log(`\nUpdated top scores for Level ${levelId}:`);
      this.highscores[levelIdStr].slice(0, Math.min(5, this.highscores[levelIdStr].length)).forEach((score, idx) => {
        const highlight = (score.username === entry.username && 
                          score.timeMs === entry.timeMs && 
                          score.timestamp === entry.timestamp) 
                          ? " <-- NEW!" : "";
        console.log(`  #${idx+1}: ${score.username} - ${this.formatTime(score.timeMs)} (${score.stars}⭐)${highlight}`);
      });
      
      // Save to disk
      this.saveHighscores();
    } else {
      console.log(`\n❌ NOT A TOP 10 SCORE`);
      console.log(`Position: #${position} of ${levelScores.length} times`);
      console.log(`Best time: ${this.formatTime(levelScores[0].timeMs)} by ${levelScores[0].username}`);
    }
    
    console.log(`==== END HIGHSCORE CHECK ====\n`);
    
    return { isTopTen, position };
  }
  
  // Helper to format time nicely for logging
  private formatTime(timeMs: number): string {
    const minutes = Math.floor(timeMs / 1000 / 60);
    const seconds = Math.floor((timeMs / 1000) % 60);
    const milliseconds = Math.floor(timeMs % 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, '0')}s ${milliseconds.toString().padStart(3, '0')}ms`;
    } else {
      return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
    }
  }
  
  // Get highscores for a level
  private getHighscores(levelId: number): Array<{username: string, timeMs: number, stars: number, timestamp: number}> {
    const levelIdStr = levelId.toString();
    return this.highscores[levelIdStr] || [];
  }
}

// Set up the server
const app = express();
const server = createServer(app);

// Serve static files
app.use(express.static('../client'));

// Create Colyseus server
const gameServer = new Server({
  server,
});

// Register both room types
gameServer.define(RoomType.OVERWORLD, GameRoom);
gameServer.define(RoomType.GAMEPLAY, GameRoom);

// Start server
const port = 3000;
gameServer.listen(port).then(() => {
  console.log(`Server listening on port ${port}`);
}); 