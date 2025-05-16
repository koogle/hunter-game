import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';



type CompletionOptions = Omit<OpenAI.Chat.ChatCompletionCreateParams, 'messages'>;

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
        messages: OpenAI.Chat.ChatCompletionCreateParams[],
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
        messages: OpenAI.Chat.ChatCompletionCreateParams[],
        schema: z.ZodType<T>,
        options?: CompletionOptions
    ): Promise<T> {
        try {
            const completion = await this.client.chat.completions.create({
                messages,
                model: options?.model || this.defaultModel,
                temperature: options?.temperature,
                max_tokens: options?.max_tokens,
                response_format: zodTextFormat(schema, 'output')
            });
            // The SDK should return the parsed output directly
            // But for compatibility, fallback to extracting from content if needed
            const msg = completion.choices[0]?.message;
            if (msg && (msg as any).output_parsed) {
                return (msg as any).output_parsed;
            }
            if (msg?.content) {
                // Fallback: try to parse JSON
                return schema.parse(JSON.parse(msg.content));
            }
            throw new Error('No structured output from OpenAI');
        } catch (error) {
            console.error('Error creating structured chat completion:', error);
            throw error;
        }
    }

    // Method for streaming chat completions
    public async createStreamingChatCompletion(
        messages: OpenAI.Chat.ChatCompletionCreateParams[],
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
