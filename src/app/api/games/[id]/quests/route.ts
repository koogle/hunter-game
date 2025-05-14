import { NextRequest } from "next/server";
import { GameState } from "@/types/game";
import { DungeonMaster } from "../../../../../lib/dm-agent";

export async function GET(request: NextRequest) {
  try {
    const gameId = request.nextUrl.pathname.split("/")[3];

    if (!gameId) {
      return new Response(JSON.stringify({ error: "Game ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const gameResponse = await fetch(
      `${request.nextUrl.origin}/api/games/${gameId}`,
    );

    if (!gameResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch game state" }),
        {
          status: gameResponse.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const game: GameState = await gameResponse.json();

    // Create DM instance to get quests from notes
    const dm = new DungeonMaster(game);
    const dmNotes = dm.getNotes();
    
    // Format quests for the frontend
    const quests = dmNotes.activeQuests.map(quest => ({
      id: quest.id,
      name: quest.name,
      description: quest.description,
      objective: quest.objective,
      status: quest.status
    }));

    return new Response(JSON.stringify(quests), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching quests:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch quests",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
