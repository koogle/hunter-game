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
  const dm = new DungeonMaster(gameState);
  
  // Create a local emit function that uses the passed io instance or falls back to the global one
  const emit = (event: string, data: any) => {
    const ioInstance = io || websocketServer.io;
    if (!ioInstance) {
      console.error('WebSocket server not initialized');
      return;
    }
    
    // Emit to the game room
    ioInstance.to(gameId).emit(event, data);
    
    // Also emit to specific socket if provided
    if (socketId) {
      ioInstance.to(socketId).emit(event, data);
    }
  };
  
  return dm.processActionWithStreaming(action, gameState, {
    onSkillCheckNotification: (request) => emit('skill-check-notification', { gameId, request }),
    onSkillCheckResult: (result) => emit('skill-check-result', { gameId, result }),
    onStreamChunk: (chunk) => emit('dm-response-chunk', { gameId, chunk }),
    onActionValidity: (validity) => emit('action-validity', { gameId, validity }),
    onError: (message) => emit('error', { gameId, message }),
  });
};

// Generic emit function to replace all the specific emit functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emitToGame = (gameId: string, event: string, data: any, socketId?: string) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  // Emit to the game room
  websocketServer.io.to(gameId).emit(event, data);

  // Also emit to specific socket if provided
  if (socketId) {
    websocketServer.io.to(socketId).emit(event, data);
  }
};

export default websocketServer;
