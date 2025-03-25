import express from 'express';
import { createServer } from 'http';
import { Server, Room, Client } from 'colyseus';
import { Schema, type, MapSchema } from "@colyseus/schema";

// Define our schema
export class PlayerPosition extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
}

export class Player extends Schema {
  @type("string") id: string;
  @type(PlayerPosition) position = new PlayerPosition();

  constructor(id: string) {
    super();
    this.id = id;
  }
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

// Create our room
class GameRoom extends Room<GameState> {
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
        
        // Log positions to confirm they're being sent
        console.log(`Player ${client.sessionId} position: [${data.x}, ${data.y}, ${data.z}]`);
      }
    });
  }

  onJoin(client: Client) {
    console.log(`Player ${client.sessionId} joined`);
    this.state.players.set(client.sessionId, new Player(client.sessionId));
    
    // Broadcast player count
    this.broadcast("player_count", { count: this.state.players.size });
  }

  onLeave(client: Client) {
    console.log(`Player ${client.sessionId} left`);
    this.state.players.delete(client.sessionId);
    
    // Broadcast player count
    this.broadcast("player_count", { count: this.state.players.size });
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