import { NextRequest } from "next/server";
import { GameState } from "@/types/game";
import OpenAIService from "../../../../../../lib/openai-service";
import { DungeonMaster, SkillCheckRequest } from "../../../../../../lib/dm-agent";

export async function POST(request: NextRequest) {
  try {
    const { message, skillCheck } = await request.json();
    const gameId = request.nextUrl.pathname.split("/")[3];
    if (!gameId) {
      return new Response(JSON.stringify({ error: "Game ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Get the current game state
    const game = await fetchGameState(request.nextUrl.origin, gameId);
    const dm = new DungeonMaster(game);
    const openaiService = OpenAIService.getInstance();
    // If skillCheck is provided, perform it, else null
    let skillCheckResult = null;
    if (skillCheck && skillCheck.required && skillCheck.stat && skillCheck.difficulty) {
      skillCheckResult = dm.performSkillCheck(skillCheck.stat, skillCheck.difficulty, game);
    }
    // Continue with the rest of the DM pipeline
    const { monologue, response } = await dm.getMonologueAndResponse(message, game, skillCheckResult, openaiService);
    const dmResponse = await dm.getDiffAndShortAnswer(response, game, openaiService);
    // Apply state changes
    const updatedGame = dm.applyStateChanges({
      ...game,
      lastUpdatedAt: new Date().toISOString(),
      messages: [
        ...game.messages,
        { role: "user", content: message },
        { role: "assistant", content: dmResponse.message }
      ]
    }, dmResponse);
    await updateGameState(request.nextUrl.origin, gameId, updatedGame);
    return new Response(
      JSON.stringify({
        shortAnswer: dmResponse.shortAnswer,
        message: dmResponse.message,
        stateChanges: dmResponse.stateChanges,
        skillCheckResult
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
