"use server";

// import { createOpenAI, openai } from "@ai-sdk/openai";
import { CoreMessage, generateObject, Schema } from "ai";
import { z } from "zod";
import { ollama } from "ollama-ai-provider";

const model = ollama("llama3.1");

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

export async function checkIfTrue(question: string, message: string): boolean {
  const resp = await generateObject({
    model,
    schema: z.object({
      is_true: z.boolean(),
      reasoning: z.array(z.string()),
    }),
    messages: [
      {
        role: "user",
        content: `Check if the question ${question} is true for the following message\'${message}\'`,
      },
    ],
  });
  console.log(resp);
  return resp.object.is_true;
}
