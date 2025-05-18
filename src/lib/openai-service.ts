import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';

type CompletionOptions = Omit<OpenAI.Chat.ChatCompletionCreateParams, 'messages' | 'model'> & { model?: string };

class OpenAIService {
    private static instance: OpenAIService;
    private client: OpenAI;
    private defaultModel = "gpt-4.1";

    private constructor() {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error('OpenAI API key is not set in environment variables');
        }

        this.client = new OpenAI({
            apiKey: apiKey,
            // You can add more configuration options here as needed
        });
    }

    public static getInstance(): OpenAIService {
        if (!OpenAIService.instance) {
            OpenAIService.instance = new OpenAIService();
        }
        return OpenAIService.instance;
    }

    public getClient(): OpenAI {
        return this.client;
    }

    // Abstracted method for chat completions
    public async createChatCompletion(
        messages: OpenAI.Chat.ChatCompletionMessageParam[],
        options?: CompletionOptions
    ): Promise<string> {
        try {
            const completion = await this.client.chat.completions.create({
                messages,
                model: options?.model || this.defaultModel,
                temperature: options?.temperature,
                max_tokens: options?.max_tokens,
            });

            return completion.choices[0]?.message?.content || '';
        } catch (error) {
            console.error('Error creating chat completion:', error);
            throw error;
        }
    }

    // Method for structured chat completions
    public async createStructuredChatCompletion<T>(
        messages: { role: string; content: string }[],
        schema: z.ZodType<T>,
        options?: CompletionOptions
    ): Promise<T | undefined> {
        try {
            const response = await this.client.responses.parse({
                model: options?.model || this.defaultModel,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                input: messages as any,
                text: {
                    format: zodTextFormat(schema, "output"),
                },
            });
            if (!response.output_parsed) {
                return undefined;
            } else {
                return response.output_parsed;
            }
        } catch (error) {
            console.error('Error creating structured chat completion:', error);
            throw error;
        }
    }

    // Method for streaming chat completions
    public async createStreamingChatCompletion(
        messages: OpenAI.Chat.ChatCompletionMessageParam[],
        options?: CompletionOptions
    ) {
        try {
            return await this.client.chat.completions.create({
                messages,
                model: options?.model || this.defaultModel,
                temperature: options?.temperature,
                max_tokens: options?.max_tokens,
                stream: true,
            });
        } catch (error) {
            console.error('Error creating streaming chat completion:', error);
            throw error;
        }
    }

    // Legacy method for backward compatibility
    public async createCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
        return this.createChatCompletion([{ role: "user", content: prompt }], options);
    }
}

export default OpenAIService;
