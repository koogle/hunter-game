"use server";

// import { createOpenAI, openai } from "@ai-sdk/openai";
import { CoreMessage, generateObject, Schema } from "ai";
import { z } from "zod";
import { ollama } from "ollama-ai-provider";

export async function createObject<OBJECT>({
  messages,
  schema,
}: {
  messages: CoreMessage[];
  schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>;
}) {
  return generateObject({
    model: ollama("llama3.1"),
    schema,
    messages,
  });
}
