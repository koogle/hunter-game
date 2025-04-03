import { NextRequest } from "next/server";
import { OpenAI } from "openai";
import { GameState } from "@/types/game";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: NextRequest
) {
  try {
    const { message } = await request.json();

    const gameId = request.nextUrl.pathname.split('/')[3];

    // Get the current game state
    const gameResponse = await fetch(
      `${request.nextUrl.origin}/api/games/${gameId}`
    );
    const game: GameState = await gameResponse.json();

    // Create a new message array with the user's message
    const updatedMessages = [...game.messages, message];

    // Prepare messages for OpenAI API
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a game master in a text adventure game. The game is set in: ${game.customScenario || game.scenario}. The player's name is ${game.name}. Keep responses concise and engaging.`,
      },
      ...updatedMessages.map((msg, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: msg,
      } as const)),
    ];

    // Call OpenAI API with streaming
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      stream: true,
    });

    // Create a new ReadableStream to handle the streaming response
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            controller.enqueue(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
          }
        }

        // Update the game state with the complete response
        const updatedGame = {
          ...game,
          messages: [...updatedMessages, fullResponse],
          lastUpdatedAt: new Date().toISOString(),
        };

        await fetch(`${request.nextUrl.origin}/api/games/${gameId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedGame),
        });

        controller.enqueue("data: [DONE]\n\n");
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in message route:", error);
    return new Response(JSON.stringify({ error: "Failed to process message" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
