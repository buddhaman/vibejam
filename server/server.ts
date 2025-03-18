import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from the client directory
app.use(express.static('../'));

// Store connected peers
const peers = new Map<string, WebSocket>();

wss.on('connection', (ws: WebSocket) => {
    let peerId: string | null = null;

    ws.on('message', (message: Buffer) => {
        const data = JSON.parse(message.toString());

        switch (data.type) {
            case 'register':
                // Register new peer
                peerId = data.peerId;
                if (peerId) {
                    peers.set(peerId, ws);
                    console.log(`Peer ${peerId} connected`);
                }
                break;

            case 'offer':
                // Forward offer to target peer
                const targetPeer = peers.get(data.target);
                if (targetPeer) {
                    targetPeer.send(JSON.stringify({
                        type: 'offer',
                        offer: data.offer,
                        from: peerId
                    }));
                }
                break;

            case 'answer':
                // Forward answer to target peer
                const answerTarget = peers.get(data.target);
                if (answerTarget) {
                    answerTarget.send(JSON.stringify({
                        type: 'answer',
                        answer: data.answer,
                        from: peerId
                    }));
                }
                break;

            case 'ice-candidate':
                // Forward ICE candidate to target peer
                const iceTarget = peers.get(data.target);
                if (iceTarget) {
                    iceTarget.send(JSON.stringify({
                        type: 'ice-candidate',
                        candidate: data.candidate,
                        from: peerId
                    }));
                }
                break;
        }
    });

    ws.on('close', () => {
        if (peerId) {
            peers.delete(peerId);
            console.log(`Peer ${peerId} disconnected`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
}); 