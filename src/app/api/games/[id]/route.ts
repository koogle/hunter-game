import { NextRequest, NextResponse } from "next/server";
import { GameStorage } from "@/lib/storage";

export async function GET(
  request: NextRequest
) {
  try {
    const id = request.nextUrl.pathname.split('/')[3];
    const game = await GameStorage.getGame(id);

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch {
    return new Response(JSON.stringify({ error: "Failed to fetch game" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function PUT(
  request: NextRequest
) {
  try {
    const id = request.nextUrl.pathname.split('/')[3];
    const body = await request.json();
    const game = await GameStorage.updateGame(id, body);

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch {
    return new Response(JSON.stringify({ error: "Failed to update game" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const id = request.nextUrl.pathname.split('/')[3];
    const success = await GameStorage.deleteGame(id);

    if (!success) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to delete game" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
