import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest } from 'next';
// Adjust the import path for typings to point to its location in the src directory
import { NextApiResponseWithSocket, SocketServer } from '@/app/api/socket/typings';
import { processPlayerAction } from '@/lib/websocket-server';
import { GameStorage } from '@/lib/storage';
// Assuming GameState is correctly typed and exported from '@/types/game'
import type { GameState } from '@/types/game';

export const config = {
    api: {
        bodyParser: false,
    },
};

const ioHandler = (_req: NextApiRequest, res: NextApiResponseWithSocket) => {
    if (!res.socket.server.io) {
        console.log('*First use, starting Socket.IO server...');
        const httpServer: SocketServer = res.socket.server;
        const io = new SocketIOServer(httpServer, {
            path: '/api/socket', // This should match the path of this API route
            addTrailingSlash: false,
        });

        io.on('connection', (socket) => {
            console.log('Client connected via Pages API Route:', socket.id);

            socket.on('join-game', (gameId: string) => {
                console.log(`Client ${socket.id} joined game ${gameId}`);
                socket.join(gameId);
            });

            socket.on('leave-game', (gameId: string) => {
                console.log(`Client ${socket.id} left game ${gameId}`);
                socket.leave(gameId);
            });

            socket.on('player-action', async ({ gameId, action, gameState }: { gameId: string; action: string; gameState: GameState }) => {
                try {
                    console.log(`Processing player action for game ${gameId}: ${action}`);
                    const result = await processPlayerAction(gameId, action, gameState, socket.id, io);

                    if (result.updatedGame) {
                        await GameStorage.updateGame(gameId, result.updatedGame);
                    }

                    // Emit the final game update
                    io.to(gameId).emit('game-update', result.updatedGame);
                    if (socket.id) {
                        io.to(socket.id).emit('game-update', result.updatedGame);
                    }

                    // Note: Individual events are now emitted in real-time during processPlayerAction
                    // We only need to handle the final completion here
                    socket.emit('action-complete', {
                        success: true,
                        gameId,
                        timestamp: new Date().toISOString()
                    });

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
    } else {
        console.log('Socket.IO server already running.');
    }
    res.end();
};

export default ioHandler;