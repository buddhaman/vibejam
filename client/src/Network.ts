import { Peer, DataConnection } from 'peerjs';
import { Game } from './Game';
import * as THREE from 'three';

export class Network {
    public peer: Peer;
    public connections: Map<string, DataConnection>;
    public game: Game;
    public ws: WebSocket;
    public peerId: string | null = null;

    constructor(game: Game) {
        this.game = game;
        this.connections = new Map();
        this.peer = new Peer();
        this.ws = new WebSocket('ws://localhost:3000');
        this.setupWebSocket();
        this.setupPeer();
    }

    public setupWebSocket(): void {
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleSignalingMessage(data);
        };
    }

    public handleSignalingMessage(data: any): void {
        switch (data.type) {
            case 'offer':
                this.handleOffer(data.offer, data.from);
                break;
            case 'answer':
                this.handleAnswer(data.answer, data.from);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(data.candidate, data.from);
                break;
        }
    }

    public setupPeer(): void {
        this.peer.on('open', (id) => {
            this.peerId = id;
            console.log('My peer ID is: ' + id);
            // Register with signaling server
            this.ws.send(JSON.stringify({
                type: 'register',
                peerId: id
            }));
        });

        this.peer.on('connection', (conn) => {
            console.log('Received connection from: ' + conn.peer);
            this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
        });
    }

    public setupConnection(conn: DataConnection): void {
        this.connections.set(conn.peer, conn);
        this.game.addPlayer(conn.peer);

        conn.on('data', (data: any) => {
            if (data.type === 'position') {
                this.game.updatePlayerPosition(conn.peer, data.position);
            }
        });

        conn.on('close', () => {
            console.log('Connection closed with: ' + conn.peer);
            this.connections.delete(conn.peer);
            this.game.removePlayer(conn.peer);
        });
    }

    public handleOffer(offer: any, from: string): void {
        this.peer.on('call', (call) => {
            call.answer(offer);
            call.on('stream', () => {
                this.setupConnection(call.peerConnection as any);
            });
        });
    }

    public handleAnswer(answer: any, from: string): void {
        // Handle answer from peer
    }

    public handleIceCandidate(candidate: any, from: string): void {
        // Handle ICE candidate from peer
    }

    public connectToPeer(peerId: string): void {
        const conn = this.peer.connect(peerId);
        this.setupConnection(conn);
    }

    public sendPosition(position: THREE.Vector3): void {
        const data = {
            type: 'position',
            position: position
        };

        this.connections.forEach(conn => {
            conn.send(data);
        });
    }
} 