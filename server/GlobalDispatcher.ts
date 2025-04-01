import { Room } from 'colyseus';

/**
 * Simple global dispatcher for communication between rooms
 */
export class GlobalDispatcher {
  // Store all active rooms
  private static rooms: Room[] = [];

  /**
   * Register a room with the dispatcher
   */
  static register(room: Room): void {
    if (!this.rooms.includes(room)) {
      this.rooms.push(room);
      console.log(`Room ${room.roomId} registered with GlobalDispatcher`);
    }
  }

  /**
   * Unregister a room from the dispatcher
   */
  static unregister(room: Room): void {
    const index = this.rooms.indexOf(room);
    if (index !== -1) {
      this.rooms.splice(index, 1);
      console.log(`Room ${room.roomId} unregistered from GlobalDispatcher`);
    }
  }

  /**
   * Broadcast a message to all registered rooms
   */
  static broadcast(messageType: string, data: any): void {
    console.log(`Broadcasting ${messageType} to ${this.rooms.length} rooms`);
    
    // For each registered room, use its presence channel to broadcast
    this.rooms.forEach(room => {
      if (room && room.presence) {
        room.presence.publish(messageType, data);
      }
    });
  }
} 