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

export async function checkIfTrue(
  gameState: string,
  question: string,
  message: string
): Promise<boolean> {
  const resp = await generateObject({
    model,
    schema: z.object({
      is_true: z.boolean(),
      reasoning: z.array(z.string()),
    }),
    messages: [
      {
        role: "system",
        content:
          "You are an expert dangeon master in a text based role playing game. The game state is:" +
          gameState,
      },
      {
        role: "user",
        content: `Check if the question ${question} is true for the following message\'${message}\'`,
      },
    ],
  });
  console.log(resp);
  return resp.object.is_true;
}
