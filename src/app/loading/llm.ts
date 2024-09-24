"use server";

import { CoreMessage, generateObject, Schema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const model = openai("gpt-4o-mini");

export async function createObject<OBJECT>({
  messages,
  schema,
}: {
  messages: CoreMessage[];
  schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>;
}) {
  return generateObject({
    model,
    schema,
    messages,
  });
}

export async function checkIfValid(
  formattedGameState: string,
  command: string
): Promise<[boolean, string]> {
  const resp = await generateObject({
    model,
    schema: z.object({
      is_valid: z.boolean(),
      reasoning: z.array(z.string()),
      clever_response: z.string(),
    }),
    messages: [
      {
        role: "system",
        content: `You are an expert dangeon master in a text based role playing game. The current state of the game is
${formattedGameState}

The user can be cheeky, but should not be allowed to break the game or get items that they do not have or move to places they cannot go.
Handle typos and other mispellings and assume the user is typing as fast as they can.
Not every action of the user needs to have a purpose and they can just interact with the world and come up with a good answer.
Mirror the tone of a magic the gathering card in terms of description mixed with Neil Geiman. Do not be patronizing and do not be too wordy.
If the user asks about what they can do give them a short list of actions they can take.
Avoid the word "you" in your response.
`,
      },
      {
        role: "user",
        content: `Check if the command '${command}' is a valid for the current state of the game or if the user should try something else.`,
      },
      {
        role: "user",
        content: `If the question is false come up with a clever answer that would make the user happy but makes it clear they should try something else.`,
      },
    ],
  });

  return [resp.object.is_valid, resp.object.clever_response];
}
