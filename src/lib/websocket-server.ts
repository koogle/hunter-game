import { Server } from 'socket.io';
import { Server as NetServer } from 'http';

import { GameState } from '@/types/game';
import { DungeonMaster, SkillCheckRequest, SkillCheckResult, DMResponse } from './dm-agent';
import OpenAIService from './openai-service';

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
  const openaiService = OpenAIService.getInstance();

  try {
    // Use the DM agent's streaming method with websocket callbacks
    const result = await dm.processActionWithStreaming(action, gameState, openaiService, {
      onSkillCheckNotification: (request) => emitSkillCheckNotification(gameId, request, socketId),
      onSkillCheckResult: (result) => emitSkillCheckResult(gameId, result, socketId),
      onStreamChunk: (chunk) => emitDMResponseStream(gameId, chunk, socketId),
      onActionValidity: (validity) => emitActionValidity(gameId, validity, socketId),
      onError: (message) => emitError(gameId, message, socketId),
    });

    // Emit final game update
    emitGameUpdate(gameId, result.updatedGame, socketId);

    return result;
  } catch (error) {
    console.error('Error processing player action:', error);
    emitError(gameId, 'Failed to process player action', socketId);
    throw error;
  }
};

export const emitGameUpdate = (gameId: string, data: GameState, socketId?: string) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  websocketServer.io.to(gameId).emit('game-update', data);
  if (socketId) {
    websocketServer.io.to(socketId).emit('game-update', data);
  }
};

export const emitDMResponseStream = (gameId: string, chunk: string, socketId?: string) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  websocketServer.io.to(gameId).emit('dm-response-chunk', chunk);
  if (socketId) {
    websocketServer.io.to(socketId).emit('dm-response-chunk', chunk);
  }
};

export const emitSkillCheckResult = (gameId: string, result: SkillCheckResult, socketId?: string) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  websocketServer.io.to(gameId).emit('skill-check-result', result);
  if (socketId) {
    websocketServer.io.to(socketId).emit('skill-check-result', result);
  }
};

export const emitActionValidity = (gameId: string, validity: { valid: boolean; reason: string | null }, socketId?: string) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  websocketServer.io.to(gameId).emit('action-validity', validity);
  if (socketId) {
    websocketServer.io.to(socketId).emit('action-validity', validity);
  }
};

export const emitSkillCheckNotification = (gameId: string, request: SkillCheckRequest, socketId?: string) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  websocketServer.io.to(gameId).emit('skill-check-notification', request);
  if (socketId) {
    websocketServer.io.to(socketId).emit('skill-check-notification', request);
  }
};

export const emitError = (gameId: string, message: string, socketId?: string) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  websocketServer.io.to(gameId).emit('error', message);
  if (socketId) {
    websocketServer.io.to(socketId).emit('error', message);
  }
};

export default websocketServer;
