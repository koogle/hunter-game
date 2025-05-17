import { NextRequest } from "next/server";
import { GameState } from "@/types/game";
import OpenAIService from "../../../../../../lib/openai-service";
import { DungeonMaster } from "../../../../../../lib/dm-agent";

export async function POST(request: NextRequest) {
  try {
    const { message, skillCheck, gameState } = await request.json();
    if (!gameState) {
      return new Response(JSON.stringify({ error: "Game state is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const dm = new DungeonMaster(gameState);
    const openaiService = OpenAIService.getInstance();
    // If skillCheck is provided, perform it, else null
    let skillCheckResult = null;
    if (skillCheck && skillCheck.required && skillCheck.stat && skillCheck.difficulty) {
      skillCheckResult = dm.performSkillCheck(skillCheck.stat, skillCheck.difficulty, gameState);
    }
    // Continue with the rest of the DM pipeline
    const { monologue, response } = await dm.getMonologueAndResponse(message, gameState, skillCheckResult, openaiService);
    const dmResponse = await dm.getDiffAndShortAnswer(response, gameState, openaiService);
    // Apply state changes
    const updatedGame = dm.applyStateChanges({
      ...gameState,
      lastUpdatedAt: new Date().toISOString(),
      messages: [
        ...gameState.messages,
        { role: "user", content: message },
        { role: "assistant", content: dmResponse.message }
      ]
    }, dmResponse);
    return new Response(
      JSON.stringify({
        shortAnswer: dmResponse.shortAnswer,
        message: dmResponse.message,
        stateChanges: dmResponse.stateChanges,
        skillCheckResult,
        updatedGame
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in resolve:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to resolve message",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function fetchGameState(origin: string, gameId: string): Promise<GameState> {
  const gameResponse = await fetch(`${origin}/api/games/${gameId}`);
  if (!gameResponse.ok) {
    throw new Error(`Failed to fetch game state: ${gameResponse.status} ${gameResponse.statusText}`);
  }
  return await gameResponse.json();
}

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
