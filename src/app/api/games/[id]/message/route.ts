import { NextRequest } from "next/server";
import { GameState, GameMessage } from "@/types/game";
import OpenAIService from "../../../../../lib/openai-service";
import { DungeonMaster, DMResponse } from "../../../../../lib/dm-agent";

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

    // Get the current game state
    const game = await fetchGameState(request.nextUrl.origin, gameId);

    // Process the user message through the DM agent
    const { updatedGame, responseStream } = await processDmResponse(game, message, request.nextUrl.origin);

    return responseStream;
  } catch (error) {
    console.error("Error processing message:", error);
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

// Helper function to fetch the game state
async function fetchGameState(origin: string, gameId: string): Promise<GameState> {
  const gameResponse = await fetch(`${origin}/api/games/${gameId}`);

  if (!gameResponse.ok) {
    throw new Error(`Failed to fetch game state: ${gameResponse.status} ${gameResponse.statusText}`);
  }

  return await gameResponse.json();
}

// Helper function to process the user message through the DM agent
async function processDmResponse(game: GameState, message: string, origin: string): Promise<{ updatedGame: GameState, responseStream: Response }> {
  // Create DM instance
  const dm = new DungeonMaster(game);
  
  // Validate if the action is valid in the game context
  if (!dm.isValidAction(message)) {
    return handleInvalidAction(dm, game, message, origin);
  }

  // Add user message to game state
  const userMessage: GameMessage = {
    role: "user",
    content: message,
  };
  const updatedMessages = [...game.messages, userMessage];
  
  // Create messages for the LLM with the DM system prompt
  const messages = dm.createMessages({
    ...game,
    messages: updatedMessages
  });

  // Get response from OpenAI with structured output
  const openaiService = OpenAIService.getInstance();
  const completion = await openaiService.createStreamingChatCompletion(messages, {
    model: "gpt-4.1",
    response_format: {
      type: "json_object"
    }
  });

  // Create a stream to handle the response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullResponse = "";

        // Process the streaming response
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            controller.enqueue(
              `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
            );
          }
        }

        // Parse and process the complete response
        const updatedGame = await processCompleteResponse(dm, game, updatedMessages as GameMessage[], fullResponse, origin);

        controller.enqueue("data: [DONE]\n\n");
        controller.close();
      } catch (error) {
        console.error("Error in stream processing:", error);
        controller.error(error);
      }
    },
  });

  return {
    updatedGame: game, // This will be updated asynchronously
    responseStream: new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  };
}

// Helper function to handle invalid actions
async function handleInvalidAction(dm: DungeonMaster, game: GameState, message: string, origin: string): Promise<{ updatedGame: GameState, responseStream: Response }> {
  const invalidActionResponse: DMResponse = {
    message: "I can't respond to that. Please stay in character and make requests that are appropriate for this fantasy role-playing game.",
    stateChanges: {}
  };
  
  const assistantMessage: GameMessage = {
    role: "assistant",
    content: invalidActionResponse.message,
  };
  
  const updatedGame = {
    ...game,
    messages: [...game.messages, 
      { role: "user" as const, content: message },
      assistantMessage
    ],
    lastUpdatedAt: new Date().toISOString(),
  };
  
  await updateGameState(origin, game.id, updatedGame);
  
  return {
    updatedGame,
    responseStream: new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: invalidActionResponse.message } }] })}\n\ndata: [DONE]\n\n`,
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    )
  };
}

// Helper function to process the complete response from the DM
async function processCompleteResponse(
  dm: DungeonMaster, 
  game: GameState, 
  updatedMessages: GameMessage[], 
  fullResponse: string,
  origin: string
): Promise<GameState> {
  // Parse the DM's structured response
  const dmResponse = dm.parseResponse(fullResponse);
  
  // Apply state changes to the game
  const updatedGame = dm.applyStateChanges({
    ...game,
    messages: updatedMessages as GameMessage[],
    lastUpdatedAt: new Date().toISOString(),
  }, dmResponse);
  
  // Add the assistant message to the game state
  const assistantMessage: GameMessage = {
    role: "assistant",
    content: dmResponse.message,
  };
  
  updatedGame.messages.push(assistantMessage);

  // Update the game state in the database
  await updateGameState(origin, game.id, updatedGame);

  return updatedGame;
}

// Helper function to update the game state in the database
async function updateGameState(origin: string, gameId: string, updatedGame: GameState): Promise<void> {
  const updateResponse = await fetch(
    `${origin}/api/games/${gameId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedGame),
    },
  );

  if (!updateResponse.ok) {
    throw new Error(`Failed to update game state: ${updateResponse.status} ${updateResponse.statusText}`);
  }
}
