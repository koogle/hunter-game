import { NextRequest, NextResponse } from 'next/server';
import { processPlayerAction } from '@/lib/websocket-server';
import { GameStorage } from '@/lib/storage';

// This route handles both WebSocket upgrade requests and regular HTTP requests
export async function GET(req: NextRequest) {
  // For WebSocket upgrade requests, the server.js file handles them
  // This is just a fallback for regular HTTP requests
  return new NextResponse('WebSocket endpoint', { status: 200 });
}

// This route handles player actions sent via HTTP when WebSocket is not available
export async function POST(req: NextRequest) {
  try {
    const { gameId, action, gameState } = await req.json();

    if (!gameId || !action || !gameState) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Process the player action
    const result = await processPlayerAction(gameId, action, gameState);

    // Save the updated game state to storage
    if (result.updatedGame) {
      await GameStorage.updateGame(gameId, result.updatedGame);
    }

    // Return the result directly (no WebSocket emission here)
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing player action:', error);
    return NextResponse.json(
      { error: 'Failed to process player action' },
      { status: 500 }
    );
  }
}
