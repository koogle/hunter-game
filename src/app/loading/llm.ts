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
      is_true: z.boolean(),
      reasoning: z.array(z.string()),
      clever_response: z.string(),
    }),
    messages: [
      {
        role: "system",
        content:
          "You are an expert dangeon master in a text based role playing game. The current state of the game is\n" +
          formattedGameState,
      },
      {
        role: "user",
        content: `Check if the command '${command}' is a valid for the current state of the game. The user can be cheeky, but should not be allowed to break the game or get items that they do not have or move to places they cannot go.`,
      },
      {
        role: "user",
        content: `If the question is false come up with a clever answer that would make the user happy but makes it clear they should try something else. `,
      },
    ],
  });

  return [resp.object.is_true, resp.object.clever_response];
}
