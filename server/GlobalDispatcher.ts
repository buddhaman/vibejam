import { Room } from 'colyseus';

/**
 * Simple global dispatcher for communication between rooms
 */
export class GlobalDispatcher {
  // Store all active rooms
  private static rooms: Set<Room> = new Set();

  /**
   * Register a room with the dispatcher
   */
  static register(room: Room): void {
    if (!this.rooms.has(room)) {
      this.rooms.add(room);
      console.log(`Room ${room.roomId} registered with GlobalDispatcher`);
      
      // Store roomId for unregistering later
      const roomId = room.roomId;
      
      // Manually unregister in server.ts onDispose() instead
    }
  }

  /**
   * Unregister a room from the dispatcher
   */
  static unregister(room: Room): void {
    if (this.rooms.has(room)) {
      this.rooms.delete(room);
      console.log(`Room ${room.roomId} unregistered from GlobalDispatcher`);
    }
  }

  /**
   * Broadcast a message to all registered rooms with active clients
   */
  static broadcast(messageType: string, data: any): void {
    // Only broadcast to rooms that have clients
    const activeRooms = Array.from(this.rooms).filter(room => room.clients.length > 0);
    
    console.log(`Broadcasting ${messageType} to ${activeRooms.length} active rooms (out of ${this.rooms.size} total)`);
    
    // For each active room, broadcast directly to clients
    activeRooms.forEach(room => {
      if (room && room.presence) {
        room.presence.publish(messageType, data);
      }
    });
  }
} 