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

    // Process the user message through the DM agent (non-streaming)
    const { updatedGame, dmResponse } = await processDmResponse(game, message, request.nextUrl.origin);

    // Optionally update game state here if needed

    return new Response(
      JSON.stringify({
        shortAnswer: dmResponse.shortAnswer,
        message: dmResponse.message,
        stateChanges: dmResponse.stateChanges
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
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
async function processDmResponse(game: GameState, message: string, origin: string): Promise<{ updatedGame: GameState, dmResponse: DMResponse }> {
  // Create DM instance
  const dm = new DungeonMaster(game);
  
  // Validate if the action is valid in the game context (now async)
  if (!await dm.isValidAction(message, game, OpenAIService.getInstance())) {
    // Optionally handle invalid action here
    throw new Error("Invalid action");
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

  // Get response from OpenAI with structured output (NOT streaming)
  const openaiService = OpenAIService.getInstance();
  const dmResponse = await openaiService.createStructuredChatCompletion(
    messages,
    // You may want to pass the DMResponseSchema here if needed
    // For now, assume the agent provides the schema
    // DMResponseSchema,
    { model: "gpt-4o" }
  );

  // Optionally apply stateChanges to game state here

  return {
    updatedGame: game, // Or updatedGame if you apply stateChanges
    dmResponse
  };
}

// Helper function to handle invalid actions
async function handleInvalidAction(dm: DungeonMaster, game: GameState, message: string, origin: string): Promise<{ updatedGame: GameState, dmResponse: DMResponse }> {
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
