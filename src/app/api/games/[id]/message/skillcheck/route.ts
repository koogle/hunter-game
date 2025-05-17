import { NextRequest } from "next/server";
import { DungeonMaster } from "../../../../../../lib/dm-agent";

export async function POST(request: NextRequest) {
  try {
    const { gameState, skillCheck } = await request.json();
    if (!gameState || !skillCheck || !skillCheck.stat || !skillCheck.difficultyCategory) {
      return new Response(
        JSON.stringify({ error: "Missing gameState or skillCheck data" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const dm = new DungeonMaster(gameState);
    const result = dm.performSkillCheck(skillCheck.stat, skillCheck.difficultyCategory, gameState);
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Skill check error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to perform skill check" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
