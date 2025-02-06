import { xai } from "@ai-sdk/xai";
import { generateText } from "ai";

const model = xai("grok-2-1212");

const SYSTEM_PROMPT = `You are an experienced and creative Dungeon Master for an interactive role-playing game.

Key Responsibilities:
1. Guide players through engaging scenarios and challenges
2. Maintain consistent world details and lore
3. Track and respond to:
   - Current scenario context
   - Player choices and their consequences
   - Game world state

Guidelines:
- Provide immersive descriptions and storytelling
- Stay consistent with established world elements
- Keep responses focused and engaging
- Consider player actions carefully
- Maintain game balance and fairness

Format your responses in a clear, narrative style suitable for a text-based RPG.
Avoid meta-commentary and stay in character as the Dungeon Master.
Only ask one question at a time.`;

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function getDungeonMasterResponse(
  messages: Message[],
  newUserMessage: string
): Promise<string> {
  try {
    const conversation = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
      { role: "user", content: newUserMessage },
    ];

    const { text } = await generateText({
      model,
      prompt: JSON.stringify(conversation),
    });

    return text;
  } catch (error) {
    console.error("Failed to get AI response:", error);
    throw new Error("Failed to get Dungeon Master's response");
  }
}
