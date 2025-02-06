import { NextRequest, NextResponse } from "next/server";
import { GameStorage } from "@/lib/storage";

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

  const game = await GameStorage.createGame({
    name: body.name,
    scenario: body.scenario,
    customScenario: body.customScenario,
    messages: body.messages || [],
  });

  return NextResponse.json(game);
}
