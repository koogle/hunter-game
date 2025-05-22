import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest } from 'next';
import { NextApiResponseWithSocket, SocketServer } from './typings';
import { processPlayerAction } from '@/lib/websocket-server';
import { GameStorage } from '@/lib/storage';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (_req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (!res.socket.server.io) {
    const httpServer: SocketServer = res.socket.server;
    const io = new SocketIOServer(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('join-game', (gameId: string) => {
        console.log(`Client ${socket.id} joined game ${gameId}`);
        socket.join(gameId);
      });

      socket.on('leave-game', (gameId: string) => {
        console.log(`Client ${socket.id} left game ${gameId}`);
        socket.leave(gameId);
      });

      socket.on('player-action', async ({ gameId, action, gameState }: { gameId: string; action: string; gameState: import('@/types/game').GameState }) => {
        try {
          console.log(`Processing player action for game ${gameId}: ${action}`);

          // Process the player action
          const result = await processPlayerAction(gameId, action, gameState);

          // Save the updated game state
          if (result.updatedGame) {
            await GameStorage.updateGame(gameId, result.updatedGame);
          }

          // Emit results to the client
          if (result.actionValidity && !result.actionValidity.valid) {
            socket.emit('action-validity', result.actionValidity);
            return;
          }

          if (result.skillCheckResult) {
            socket.emit('skill-check-result', result.skillCheckResult);
          }

          if (result.dmResponse) {
            socket.emit('dm-response', result.dmResponse);
          }

          if (result.updatedGame) {
            socket.emit('game-update', result.updatedGame);
          }
        } catch (error) {
          console.error('Error processing player action:', error);
          socket.emit('error', { message: 'Failed to process player action' });
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
};

export default ioHandler;
