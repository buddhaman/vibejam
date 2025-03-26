import express from 'express';
import { createServer } from 'http';
import { Server, Room, Client } from 'colyseus';
import { Schema, type, MapSchema } from "@colyseus/schema";

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

// Create our room
class GameRoom extends Room<GameState> {
  // Store level completions
  private levelCompletions: LevelCompletion[] = [];

  onCreate() {
    this.state = new GameState();
    console.log("Game room created!");

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
        
        // Broadcast to all players
        this.broadcast("level_completed_by", {
          username: player.username,
          levelId: data.levelId,
          timeMs: data.timeMs,
          stars: data.stars || 0
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
  
  // Get top scores for a level
  getTopScores(levelId: number, limit: number = 10): LevelCompletion[] {
    return this.levelCompletions
      .filter(c => c.levelId === levelId)
      .sort((a, b) => a.timeMs - b.timeMs) // Sort by time (fastest first)
      .slice(0, limit);
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

// Register room
gameServer.define('game_room', GameRoom);

// Start server
const port = 3000;
gameServer.listen(port).then(() => {
  console.log(`Server listening on port ${port}`);
}); 