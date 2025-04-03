import { NextResponse } from "next/server";
import OpenAI from "openai";

const MODEL_NAME = "gpt-4o-mini-2024-07-18";

// Validate that the API key exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API key. Please add OPENAI_API_KEY to your .env.local file.');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { scenario } = await req.json();

    if (!scenario) {
      return NextResponse.json(
        { error: "Scenario is required" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      messages: [
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
      ],
      model: MODEL_NAME,
      temperature: 0.8,
    });

    const description = completion.choices[0]?.message?.content || "";

    return NextResponse.json({ description });
  } catch (error) {
    console.error("Error generating scenario description:", error);
    return NextResponse.json(
      { error: "Failed to generate scenario description" },
      { status: 500 }
    );
  }
} 