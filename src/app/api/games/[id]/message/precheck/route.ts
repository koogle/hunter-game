import { NextRequest } from "next/server";
import { GameState } from "@/types/game";
import OpenAIService from "../../../../../../lib/openai-service";
import { DungeonMaster } from "../../../../../../lib/dm-agent";

export async function POST(request: NextRequest) {
  try {
    const { message, gameState } = await request.json();
    if (!gameState) {
      return new Response(JSON.stringify({ error: "Game state is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const dm = new DungeonMaster(gameState);
    const openaiService = OpenAIService.getInstance();
    // Use the new precheckAction method
    const result = await dm.precheckAction(message, gameState, openaiService);
    return new Response(
      JSON.stringify(result),
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