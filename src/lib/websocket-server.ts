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
  socketId?: string
): Promise<{
  skillCheckRequest: SkillCheckRequest | undefined;
  skillCheckResult: SkillCheckResult | undefined;
  dmResponse: DMResponse;
  actionValidity: { valid: boolean; reason: string | null };
  updatedGame: GameState;
}> => {
  const dm = new DungeonMaster(gameState);

  // Use the DM agent's streaming method with websocket callbacks
  const result = await dm.processActionWithStreaming(action, gameState, {
    onSkillCheckNotification: (request: SkillCheckRequest) => emitToGame(gameId, 'skill-check-notification', request, socketId),
    onSkillCheckResult: (result: SkillCheckResult) => emitToGame(gameId, 'skill-check-result', result, socketId),
    onStreamChunk: (chunk: string) => emitToGame(gameId, 'dm-response-chunk', chunk, socketId),
    onActionValidity: (validity: { valid: boolean; reason: string | null }) => emitToGame(gameId, 'action-validity', validity, socketId),
    onError: (message: string) => emitToGame(gameId, 'error', message, socketId),
  });

  // Always emit final game update (errors are now part of the game history)
  emitToGame(gameId, 'game-update', result.updatedGame, socketId);

  return result;
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
