import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_STATS, GameStorage } from "@/lib/storage";
import { GameMessage } from "@/types/game";

export async function GET() {
  const games = await GameStorage.listGames();
  return NextResponse.json(games);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.name || (!body.scenario && !body.customScenario)) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const initialMessages: GameMessage[] = [
    {
      role: "assistant",
      content: `Welcome, ${body.name}!`
    },
    {
      role: "assistant",
      content: `Your adventure begins in: ${body.customScenario || body.scenario}`
    }
  ];

  const game = await GameStorage.createGame({
    name: body.name,
    scenario: body.scenario,
    customScenario: body.customScenario,
    messages: initialMessages,
    stats: DEFAULT_STATS,
    playerNotes: "",
    inventory: [
      {
        name: "Iron Sword",
        quantity: 1,
        description: "A basic sword for combat"
      },
      {
        name: "Leather Shield",
        quantity: 1,
        description: "Provides basic protection"
      },
      {
        name: "Health Potion",
        quantity: 3,
        description: "Restores 20 health"
      }
    ]
  });

  return NextResponse.json(game);
}
