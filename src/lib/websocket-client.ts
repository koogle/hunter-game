import { io, Socket } from 'socket.io-client';
import { GameState, GameMessage } from '@/types/game';
import { SkillCheckResult } from './dm-agent';

// Ensure we only initialize the socket once on the client side
let socket: Socket | null = null;

interface WebSocketClientInstance {
  socket: Socket | null;
  initialized: boolean;
  gameId: string | null;
  callbacks: {
    onDMResponseChunk: ((chunk: string) => void) | null;
    onSkillCheckResult: ((result: SkillCheckResult) => void) | null;
    onActionValidity: ((validity: { valid: boolean; reason: string | null }) => void) | null;
    onGameUpdate: ((gameState: GameState) => void) | null;
  };
}

export const websocketClient: WebSocketClientInstance = {
  socket: null,
  initialized: false,
  gameId: null,
  callbacks: {
    onDMResponseChunk: null,
    onSkillCheckResult: null,
    onActionValidity: null,
    onGameUpdate: null,
  },
};

export const initWebSocketClient = () => {
  // Only create the socket on the client side
  if (typeof window === 'undefined') return null;
  
  if (websocketClient.initialized && websocketClient.socket) {
    return websocketClient.socket;
  }

  // Reuse the socket if it already exists
  if (socket) {
    websocketClient.socket = socket;
    websocketClient.initialized = true;
    return socket;
  }

  // Create a new socket connection
  socket = io({
    path: '/api/socket',
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    websocketClient.initialized = true;
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
  });

  socket.on('dm-response-chunk', (chunk: string) => {
    if (websocketClient.callbacks.onDMResponseChunk) {
      websocketClient.callbacks.onDMResponseChunk(chunk);
    }
  });

  socket.on('skill-check-result', (result: SkillCheckResult) => {
    if (websocketClient.callbacks.onSkillCheckResult) {
      websocketClient.callbacks.onSkillCheckResult(result);
    }
  });

  socket.on('action-validity', (validity: { valid: boolean; reason: string | null }) => {
    if (websocketClient.callbacks.onActionValidity) {
      websocketClient.callbacks.onActionValidity(validity);
    }
  });

  socket.on('game-update', (gameState: GameState) => {
    if (websocketClient.callbacks.onGameUpdate) {
      websocketClient.callbacks.onGameUpdate(gameState);
    }
  });

  websocketClient.socket = socket;
  return socket;
};

export const joinGame = (gameId: string) => {
  if (!websocketClient.socket) {
    console.error('WebSocket client not initialized');
    return;
  }

  websocketClient.gameId = gameId;
  websocketClient.socket.emit('join-game', gameId);
};

export const leaveGame = () => {
  if (!websocketClient.socket || !websocketClient.gameId) {
    console.error('WebSocket client not initialized or no game joined');
    return;
  }

  websocketClient.socket.emit('leave-game', websocketClient.gameId);
  websocketClient.gameId = null;
};

export const sendPlayerAction = async (action: string, gameState: GameState) => {
  if (!websocketClient.socket || !websocketClient.gameId) {
    console.error('WebSocket client not initialized or no game joined');
    
    // Fallback to HTTP API if WebSocket is not available
    try {
      const response = await fetch(`/api/socket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameState.id,
          action,
          gameState,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send player action via HTTP');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending player action via HTTP:', error);
      throw error;
    }
  }

  // Send via WebSocket if available
  websocketClient.socket.emit('player-action', {
    gameId: websocketClient.gameId,
    action,
    gameState,
  });
};

export const setCallbacks = ({
  onDMResponseChunk,
  onSkillCheckResult,
  onActionValidity,
  onGameUpdate,
}: {
  onDMResponseChunk?: (chunk: string) => void;
  onSkillCheckResult?: (result: SkillCheckResult) => void;
  onActionValidity?: (validity: { valid: boolean; reason: string | null }) => void;
  onGameUpdate?: (gameState: GameState) => void;
}) => {
  if (onDMResponseChunk) {
    websocketClient.callbacks.onDMResponseChunk = onDMResponseChunk;
  }
  if (onSkillCheckResult) {
    websocketClient.callbacks.onSkillCheckResult = onSkillCheckResult;
  }
  if (onActionValidity) {
    websocketClient.callbacks.onActionValidity = onActionValidity;
  }
  if (onGameUpdate) {
    websocketClient.callbacks.onGameUpdate = onGameUpdate;
  }
};

export default websocketClient;
