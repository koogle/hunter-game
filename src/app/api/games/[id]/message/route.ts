import { NextRequest } from "next/server";
import { OpenAI } from "openai";
import { GameState, GameMessage } from "@/types/game";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const LOCAL_MODE = false;

const openai = new OpenAI({
  ...(LOCAL_MODE
    ? { baseUrl: "http://localhost:11434/v1", apiKey: "ollama" }
    : { apiKey: process.env.OPENAI_API_KEY }),
});

const MODEL = LOCAL_MODE ? "llama3.2" : "gpt-4";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
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

    const userMessage: GameMessage = {
      role: "user",
      content: message,
    };
    const updatedMessages = [...game.messages, userMessage];

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a game master in a text adventure game. The game is set in: ${game.customScenario || game.scenario}. The player's name is ${game.name}. Keep responses concise and engaging.`,
      },
      ...(updatedMessages
        .filter(
          (msg) =>
            msg.content !== undefined &&
            msg.content !== null &&
            msg.content.trim() !== "",
        )
        .map((msg) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        })) as ChatCompletionMessageParam[]),
    ];

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = "";

          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              fullResponse += content;
              controller.enqueue(
                `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
              );
            }
          }

          const assistantMessage: GameMessage = {
            role: "assistant",
            content: fullResponse,
          };
          const updatedGame = {
            ...game,
            messages: [...updatedMessages, assistantMessage],
            lastUpdatedAt: new Date().toISOString(),
          };

          const updateResponse = await fetch(
            `${request.nextUrl.origin}/api/games/${gameId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updatedGame),
            },
          );

          if (!updateResponse.ok) {
            throw new Error("Failed to update game state");
          }

          controller.enqueue("data: [DONE]\n\n");
          controller.close();
        } catch (error) {
          controller.error(error);
        }
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
    return new Response(
      JSON.stringify({
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
