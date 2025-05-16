import { NextRequest } from "next/server";
import { GameState, GameMessage } from "@/types/game";
import OpenAIService from "../../../../../lib/openai-service";
import { DungeonMaster, DMResponse } from "../../../../../lib/dm-agent";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    const gameId = request.nextUrl.pathname.split("/")[3];

    if (!gameId) {
      return new Response(JSON.stringify({ error: "Game ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the current game state
    const game = await fetchGameState(request.nextUrl.origin, gameId);

    // Create DM agent and OpenAI service
    const dm = new DungeonMaster(game);
    const openaiService = OpenAIService.getInstance();

    // Call the DM agent for all LLM logic
    const { skillCheckRequest, skillCheckResult, longAnswer, dmResponse } = await dm.processPlayerAction(message, game, openaiService);

    // Apply state changes to the game state (pure)
    const updatedGame = dm.applyStateChanges({
      ...game,
      lastUpdatedAt: new Date().toISOString(),
      messages: [
        ...game.messages,
        { role: "user", content: message },
        { role: "assistant", content: dmResponse.message }
      ]
    }, dmResponse);

    // Persist the updated game state
    await updateGameState(request.nextUrl.origin, gameId, updatedGame);

    // Return only the relevant fields
    return new Response(
      JSON.stringify({
        shortAnswer: dmResponse.shortAnswer,
        message: dmResponse.message,
        stateChanges: dmResponse.stateChanges
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing message:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// Helper function to fetch the game state
async function fetchGameState(origin: string, gameId: string): Promise<GameState> {
  const gameResponse = await fetch(`${origin}/api/games/${gameId}`);

  if (!gameResponse.ok) {
    throw new Error(`Failed to fetch game state: ${gameResponse.status} ${gameResponse.statusText}`);
  }

  return await gameResponse.json();
}

// Helper function to update the game state in the database
async function updateGameState(origin: string, gameId: string, updatedGame: GameState): Promise<void> {
  const updateResponse = await fetch(
    `${origin}/api/games/${gameId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedGame),
    },
  );

  if (!updateResponse.ok) {
    throw new Error(`Failed to update game state: ${updateResponse.status} ${updateResponse.statusText}`);
  }
}
