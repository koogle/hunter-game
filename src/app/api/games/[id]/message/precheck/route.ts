import { NextRequest } from "next/server";
import { GameState } from "@/types/game";
import OpenAIService from "../../../../../../lib/openai-service";
import { DungeonMaster } from "../../../../../../lib/dm-agent";

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
    const dm = new DungeonMaster(game);
    const openaiService = OpenAIService.getInstance();
    // Run validity and skill check LLM calls in parallel
    const [validity, skillCheck] = await Promise.all([
      dm.isValidAction(message, game, openaiService),
      dm.getSkillCheckRequest(message, game, openaiService)
    ]);
    return new Response(
      JSON.stringify({ valid: validity.valid, reason: validity.reason, skillCheck }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in precheck:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to precheck message",
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
