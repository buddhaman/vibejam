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
  // Path to highscores file
  private highscoresPath = path.join(__dirname, 'highscores.json');
  // In-memory highscores cache
  private highscores: {[levelId: string]: Array<{username: string, timeMs: number, stars: number, timestamp: number}>} = {};

  onCreate() {
    this.state = new GameState();
    console.log(`Game room created! Room ID: ${this.roomId}`);
    
    // Register with the GlobalDispatcher
    GlobalDispatcher.register(this);
    
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
        
        // Create the completion data
        const completionData = {
          username: player.username,
          levelId: data.levelId,
          timeMs: data.timeMs,
          stars: data.stars || 0
        };
        
        // ALWAYS broadcast level completion to ALL rooms using GlobalDispatcher
        console.log(`Broadcasting level completion for ${player.username} on level ${data.levelId}`);
        GlobalDispatcher.broadcast("level_completion", completionData);
        
        // Check for highscore separately
        const highscoreResult = this.addHighscore(data.levelId, {
          username: player.username,
          timeMs: data.timeMs,
          stars: data.stars || 0,
          timestamp: Date.now()
        });
        
        // If it's a highscore, broadcast that separately
        if (highscoreResult.isTopTen) {
          const position = highscoreResult.position;
          console.log(`HIGHSCORE: ${player.username} got position #${position} on level ${data.levelId}`);
          
          const highscoreData = {
            ...completionData,
            position: position
          };
          
          // Broadcast highscore using GlobalDispatcher
          GlobalDispatcher.broadcast("highscore", highscoreData);
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

    // Add global notification handler with GlobalDispatcher
    this.onMessage("send_global_notification", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && data.text) {
        console.log(`Global notification from ${player.username}: ${data.text}`);
        
        // Broadcast simple text message to all rooms using GlobalDispatcher
        GlobalDispatcher.broadcast("broadcast", data.text);
      }
    });

    // Simplify to a basic text-only notification system
    this.presence.subscribe("broadcast", (message: string) => {
      console.log(`[${this.roomId}] Received broadcast message: ${message}`);
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
  
  // Load highscores from disk
  private loadHighscores(): void {
    try {
      if (fs.existsSync(this.highscoresPath)) {
        const data = fs.readFileSync(this.highscoresPath, 'utf8');
        this.highscores = JSON.parse(data);
        console.log("Highscores loaded from disk");
      } else {
        this.highscores = {};
        console.log("No highscores file found, starting with empty highscores");
      }
    } catch (error) {
      console.error("Error loading highscores:", error);
      this.highscores = {};
    }
  }
  
  // Save highscores to disk
  private saveHighscores(): void {
    try {
      // Save to a temp file first to avoid nodemon restart
      const tempFile = path.join(__dirname, '.tmp_highscores.json');
      const data = JSON.stringify(this.highscores, null, 2);
      
      // Write to temp file
      fs.writeFileSync(tempFile, data, 'utf8');
      
      // Then rename (atomic operation) to avoid nodemon watching the write
      fs.renameSync(tempFile, this.highscoresPath);
      
      console.log(`Highscores saved to ${this.highscoresPath}`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Error saving highscores: ${error.message}`);
      } else {
        console.error('Error saving highscores: Unknown error type');
      }
    }
  }
  
  // Update the addHighscore method to return both whether it's a top 10 score and its position
  private addHighscore(levelId: number, entry: {username: string, timeMs: number, stars: number, timestamp: number}): {isTopTen: boolean, position: number} {
    const levelIdStr = levelId.toString();
    
    // Initialize array for this level if it doesn't exist
    if (!this.highscores[levelIdStr]) {
      this.highscores[levelIdStr] = [];
    }
    
    // Get current highscores for this level
    const levelScores = [...this.highscores[levelIdStr]]; // Clone array
    
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
      
      // Save to disk
      this.saveHighscores();
      
      console.log(`Added highscore for ${entry.username} at position #${position} (time: ${entry.timeMs}ms)`);
    } else {
      console.log(`Score for ${entry.username} (${entry.timeMs}ms) not in top 10`);
    }
    
    return { isTopTen, position };
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