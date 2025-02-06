import { NextRequest } from "next/server";
import { GameStorage } from "@/lib/storage";
import { Message, streamText } from "ai";
import { xai } from "@ai-sdk/xai";

const model = xai("grok-2-1212");

const SYSTEM_PROMPT = `You are an experienced and creative Dungeon Master for an interactive role-playing game.
Keep responses focused and engaging. Stay in character as the Dungeon Master.
Only ask one question at a time.`;

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { messages } = await request.json();

    // Get current game state
    const game = await GameStorage.getGame(id);
    if (!game) {
      throw new Error("Game not found");
    }

    // Create conversation array with system prompt
    const conversationMessages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // Get streaming response using streamText
    const result = streamText({
      model,
      messages: conversationMessages,
    });

    // Collect the full response for game state update
    let fullResponse = "";
    for await (const chunk of result.textStream) {
      fullResponse += chunk;
    }

    // Update game state after stream completes
    GameStorage.updateGame(id, {
      messages: [
        ...game.messages,
        messages[messages.length - 1].content,
        fullResponse,
      ],
    });

    // Return data stream response
    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Message handler error:", error);
    throw error;
  }
}
