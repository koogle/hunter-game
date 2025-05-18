import { Server } from 'socket.io';
import { Server as NetServer } from 'http';
import { NextApiRequest } from 'next';
import { NextApiResponse } from 'next';
import { GameState, GameMessage } from '@/types/game';
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
  gameState: GameState
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
    // Step 1: Check if action is valid
    const actionValidity = await dm.isValidAction(action, gameState, openaiService);

    if (!actionValidity.valid) {
      return {
        skillCheckRequest: undefined,
        skillCheckResult: undefined,
        dmResponse: {
          message: actionValidity.reason || 'Invalid action',
          shortAnswer: actionValidity.reason || 'Invalid action',
          stateChanges: {},
        },
        actionValidity,
        updatedGame: gameState,
      };
    }

    // Step 2: Get skill check request if needed
    const skillCheckRequest = await dm.getSkillCheckRequest(action, gameState, openaiService);

    // Step 3: Perform skill check if required
    let skillCheckResult: SkillCheckResult | undefined = undefined;
    if (skillCheckRequest && skillCheckRequest.required) {
      skillCheckResult = dm.performSkillCheck(
        skillCheckRequest.stat!,
        skillCheckRequest.difficultyCategory!,
        gameState
      );
    }

    // Step 4: Generate DM response
    const response = await dm.getResponse(action, gameState, skillCheckResult, openaiService);

    // Step 5: Parse for state changes and short answer
    const dmResponse = await dm.getDiffAndShortAnswer(response, gameState, openaiService);

    // Step 6: Apply state changes to game state
    const updatedMessages = [
      ...gameState.messages,
      { role: 'user', content: action } as GameMessage,
    ];

    // Add skill check message if performed
    if (skillCheckResult && skillCheckResult.performed) {
      updatedMessages.push({
        role: 'assistant',
        content: `Skill Check Result: ${skillCheckResult.stat?.toUpperCase()} (${skillCheckResult.statValue}) + d12 (${skillCheckResult.roll}) vs difficulty ${skillCheckResult.difficulty} → ${skillCheckResult.success ? 'SUCCESS' : 'FAILURE'} (Δ${skillCheckResult.degree})${skillCheckResult.reason ? ': ' + skillCheckResult.reason : ''}`
      } as GameMessage);
    }

    // Add DM response
    updatedMessages.push({
      role: 'assistant',
      content: dmResponse.message
    } as GameMessage);

    const updatedGame = dm.applyStateChanges({
      ...gameState,
      lastUpdatedAt: new Date().toISOString(),
      messages: updatedMessages
    }, dmResponse);

    return {
      skillCheckRequest,
      skillCheckResult,
      dmResponse,
      actionValidity,
      updatedGame,
    };
  } catch (error) {
    console.error('Error processing player action:', error);
    throw error;
  }
};

export const emitGameUpdate = (gameId: string, data: any) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  websocketServer.io.to(gameId).emit('game-update', data);
};

export const emitDMResponseStream = (gameId: string, chunk: string) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  websocketServer.io.to(gameId).emit('dm-response-chunk', chunk);
};

export const emitSkillCheckResult = (gameId: string, result: SkillCheckResult) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  websocketServer.io.to(gameId).emit('skill-check-result', result);
};

export const emitActionValidity = (gameId: string, validity: { valid: boolean; reason: string | null }) => {
  if (!websocketServer.io) {
    console.error('WebSocket server not initialized');
    return;
  }

  websocketServer.io.to(gameId).emit('action-validity', validity);
};

export default websocketServer;
