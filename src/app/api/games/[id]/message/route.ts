import { NextRequest, NextResponse } from "next/server";
import { GameStorage } from "@/lib/storage";
import { streamText } from "ai";
import { xai } from "@ai-sdk/xai";

const model = xai("grok-2-1212");

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get current game state
    const game = await GameStorage.getGame(id);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Format messages for AI
    const formattedMessages = game.messages.map((msg, index) => ({
      role: index === 0 ? "assistant" : index % 2 === 0 ? "assistant" : "user",
      content: msg,
    }));

    // Create conversation array with new message
    const conversation = [
      ...formattedMessages,
      { role: "user", content: message },
    ];

    // Get streaming response
    const result = streamText({
      model,
      prompt: JSON.stringify(conversation),
    });

    // Create response stream
    const response = result.toTextStreamResponse();

    // Update game state after streaming completes
    result.textStream.pipeTo(
      new WritableStream({
        close: async () => {
          const fullResponse = await result.text;
          await GameStorage.updateGame(id, {
            messages: [...game.messages, message, fullResponse],
          });
        },
      })
    );

    return response;
  } catch (error) {
    console.error("Message handler error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
