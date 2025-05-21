import { NextRequest } from "next/server";
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
    // Use skillCheckResult if provided (frontend is now responsible for running the skill check)
    const skillCheckResult = (typeof skillCheck === 'object' && skillCheck !== null && 'performed' in skillCheck)
      ? skillCheck
      : null;
    // Continue with the rest of the DM pipeline
    const response = await dm.getResponse(message, gameState, skillCheckResult, openaiService);
    const dmResponse = await dm.parseStateChanges(response, gameState, openaiService);
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
