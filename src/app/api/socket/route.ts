import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '@/types/next';
import { initWebSocketServer } from '@/lib/websocket-server';

export const config = {
  api: {
    bodyParser: false,
  },
};

// This handler ensures the WebSocket server is initialized with real game logic
export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    // Use the real game server logic
    initWebSocketServer(res.socket.server);
  }
  res.end();
}
