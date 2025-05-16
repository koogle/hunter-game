import { NextResponse } from "next/server";
import OpenAIService from "../../../lib/openai-service";
import OpenAI from "openai";

// Validate that the API key exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API key. Please add OPENAI_API_KEY to your .env.local file.');
}

export async function POST(req: Request) {
  try {
    const { scenario } = await req.json();

    if (!scenario) {
      return NextResponse.json(
        { error: "Scenario is required" },
        { status: 400 }
      );
    }

    const openaiService = OpenAIService.getInstance();
    const messages: OpenAI.Chat.ChatCompletionCreateParams[] = [
      {
        role: "system",
        content: `You are a creative game master. Create a rich, detailed description for a game scenario. 
        The description should be engaging, immersive, and provide enough detail for players to understand the setting and potential adventures.
        Keep it between 2-3 paragraphs.`,
      },
      {
        role: "user",
        content: `Create a detailed description for the scenario: ${scenario}`,
      },
    ];

    const description = await openaiService.createChatCompletion(messages, {
      temperature: 0.5
    });

    return NextResponse.json({ description });
  } catch (error) {
    console.error("Error generating scenario description:", error);
    return NextResponse.json(
      { error: "Failed to generate scenario description" },
      { status: 500 }
    );
  }
} 