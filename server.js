const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO server
  const io = new Server(server, {
    path: '/api/socket',
    addTrailingSlash: false,
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-game', (gameId) => {
      console.log(`Client ${socket.id} joined game ${gameId}`);
      socket.join(gameId);
    });

    socket.on('leave-game', (gameId) => {
      console.log(`Client ${socket.id} left game ${gameId}`);
      socket.leave(gameId);
    });

    socket.on('player-action', async ({ gameId, action, gameState }) => {
      try {
        console.log(`Processing player action for game ${gameId}: ${action}`);
        
        // Import modules dynamically to avoid issues with Next.js
        const { processPlayerAction } = require('./src/lib/websocket-server');
        const { GameStorage } = require('./src/lib/storage');
        
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
          // Stream the DM response in chunks
          const message = result.dmResponse.message;
          const chunkSize = 10; // characters per chunk
          
          for (let i = 0; i < message.length; i += chunkSize) {
            const chunk = message.substring(i, i + chunkSize);
            socket.emit('dm-response-chunk', chunk);
            // Small delay to simulate typing
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          // Send complete response
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

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
