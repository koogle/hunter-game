import { Server } from 'socket.io';
import { Server as NetServer } from 'http';

import { GameState } from '@/types/game';
import { DungeonMaster, SkillCheckRequest, SkillCheckResult, DMResponse } from './dm-agent';

interface WebSocketServerInstance {
  io: Server | null;
  initialized: boolean;
}

export const websocketServer: WebSocketServerInstance = {
  io: null,
  initialized: false,
};

export const initWebSocketServer = (server: NetServer) => {
  if (websocketServer.initialized) return;

  const io = new Server(server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  io.on('connection', (socket: any) => {
    console.log('Client connected:', socket.id);

    socket.on('join-game', (gameId: string) => {
      console.log(`Client ${socket.id} joined game ${gameId}`);
      socket.join(gameId);
    });

    socket.on('leave-game', (gameId: string) => {
      console.log(`Client ${socket.id} left game ${gameId}`);
      socket.leave(gameId);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  websocketServer.io = io;
  websocketServer.initialized = true;

  console.log('WebSocket server initialized');
};

export const processPlayerAction = async (
  gameId: string,
  action: string,
  gameState: GameState,
  socketId?: string,
  io?: Server
): Promise<{
  skillCheckRequest: SkillCheckRequest | undefined;
  skillCheckResult: SkillCheckResult | undefined;
  dmResponse: DMResponse;
  actionValidity: { valid: boolean; reason: string | null };
  updatedGame: GameState;
}> => {
  console.log(`[WebSocketServer] processPlayerAction START - GameID: ${gameId}, Action: "${action}", SocketID: ${socketId || 'N/A'}, Initial Messages: ${gameState.messages.length}`);
  const dm = new DungeonMaster(gameState);

  // Create a local emit function that uses the passed io instance or falls back to the global one
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emit = (event: string, data: any) => {
    const ioInstance = io || websocketServer.io;
    if (!ioInstance) {
      console.error('WebSocket server not initialized');
      return;
    }

    ioInstance.to(gameId).emit(event, data);
  };

  return dm.processActionWithStreaming(action, gameState, {
    onSkillCheckNotification: (request) => emit('skill-check-notification', request),
    onSkillCheckResult: (result) => emit('skill-check-result', result),
    onStreamChunk: (chunk) => emit('dm-response-chunk', chunk),
    onActionValidity: (validity) => emit('action-validity', validity),
    onError: (message) => emit('error', message),
  }).then(result => {
    console.log(`[WebSocketServer] processPlayerAction END - GameID: ${gameId}, Final Messages: ${result.updatedGame.messages.length}`);
    return result;
  }).catch(error => {
    console.error(`[WebSocketServer] processPlayerAction ERROR - GameID: ${gameId}, Error:`, error);
    throw error;
  });
};

export default websocketServer;
