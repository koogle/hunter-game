import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest } from 'next';
import { NextApiResponse } from 'next';
import { processPlayerAction } from '@/lib/websocket-server';
import { GameStorage } from '@/lib/storage';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: NextApiResponse) => {
  if (res.socket && !('io' in res.socket.server)) {
    const httpServer: NetServer = res.socket.server as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = new SocketIOServer(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
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

    (res.socket.server as any).io = io;
  }

  res.end();
};

export default ioHandler;
