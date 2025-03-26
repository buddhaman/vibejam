export interface PlayerPosition {
    x: number;
    y: number;
    z: number;
    dirX: number;
    dirY: number;
    dirZ: number;
}

export interface Player {
    id: string;
    username: string;
    position: PlayerPosition;
}

export interface GameState {
    players: Map<string, Player>;
}