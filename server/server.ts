import express from 'express';
import { createServer } from 'http';
import { Server, Room, Client } from 'colyseus';
import { Schema, type, MapSchema } from "@colyseus/schema";
import fs from 'fs';
import path from 'path';

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
    console.log("Game room created!");
    
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

    // Handle level completions
    this.onMessage("level_complete", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && data.levelId !== undefined && data.timeMs !== undefined) {
        // Store the completion
        const completion: LevelCompletion = {
          playerId: client.sessionId,
          username: player.username,
          levelId: data.levelId,
          timeMs: data.timeMs,
          stars: data.stars || 0,
          timestamp: Date.now()
        };
        
        this.levelCompletions.push(completion);
        console.log(`Player ${player.username} (${client.sessionId}) completed level ${data.levelId} in ${data.timeMs}ms with ${data.stars} stars`);
        
        // Check if this is a new highscore
        const isNewHighscore = this.addHighscore(data.levelId, {
          username: player.username,
          timeMs: data.timeMs,
          stars: data.stars || 0,
          timestamp: Date.now()
        });
        
        // Broadcast to all players
        this.broadcast("level_completed_by", {
          username: player.username,
          levelId: data.levelId,
          timeMs: data.timeMs,
          stars: data.stars || 0
        });
        
        // If it's a new highscore, broadcast that too
        if (isNewHighscore) {
          console.log(`New highscore! ${player.username} got position ${this.getHighscorePosition(data.levelId, data.timeMs)} on level ${data.levelId}`);
          this.broadcast("new_highscore", {
            username: player.username,
            levelId: data.levelId,
            timeMs: data.timeMs,
            stars: data.stars || 0,
            position: this.getHighscorePosition(data.levelId, data.timeMs)
          });
        }
        
        // Important: Send highscores immediately after processing the completion
        // This way we don't need a separate request
        const levelHighscores = this.getHighscores(data.levelId);
        client.send("level_highscores", {
          levelId: data.levelId,
          highscores: levelHighscores
        });
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
      fs.writeFileSync(this.highscoresPath, JSON.stringify(this.highscores, null, 2), 'utf8');
      console.log("Highscores saved to disk");
    } catch (error) {
      console.error("Error saving highscores:", error);
    }
  }
  
  // Add a highscore and return true if it's a new top 10 entry
  private addHighscore(levelId: number, entry: {username: string, timeMs: number, stars: number, timestamp: number}): boolean {
    const levelIdStr = levelId.toString();
    
    // Initialize array for this level if it doesn't exist
    if (!this.highscores[levelIdStr]) {
      this.highscores[levelIdStr] = [];
    }
    
    // Get current highscores for this level
    const levelScores = this.highscores[levelIdStr];
    
    // Check if this score qualifies for top 10
    const worstTopScore = levelScores.length >= 10 ? 
      levelScores.sort((a, b) => a.timeMs - b.timeMs)[9] : 
      { timeMs: Infinity };
    
    const isTopTen = entry.timeMs < worstTopScore.timeMs || levelScores.length < 10;
    
    if (isTopTen) {
      // Add the new score
      levelScores.push(entry);
      
      // Sort by time (fastest first) and keep only top 10
      this.highscores[levelIdStr] = levelScores
        .sort((a, b) => a.timeMs - b.timeMs)
        .slice(0, 10);
      
      // Save to disk
      this.saveHighscores();
      
      return true;
    }
    
    return false;
  }
  
  // Get highscores for a level
  private getHighscores(levelId: number): Array<{username: string, timeMs: number, stars: number, timestamp: number}> {
    const levelIdStr = levelId.toString();
    return this.highscores[levelIdStr] || [];
  }
  
  // Get position of a score in the highscore list (1-based)
  private getHighscorePosition(levelId: number, timeMs: number): number {
    const levelIdStr = levelId.toString();
    const scores = this.highscores[levelIdStr] || [];
    
    // Sort scores by time
    const sortedScores = [...scores].sort((a, b) => a.timeMs - b.timeMs);
    
    // Find position (1-based)
    for (let i = 0; i < sortedScores.length; i++) {
      if (sortedScores[i].timeMs === timeMs) {
        return i + 1;
      }
    }
    
    return -1; // Not found
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