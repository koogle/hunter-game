import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

interface CompletionOptions {
    model?: string;
    temperature?: number;
    max_tokens?: number;
}

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
        messages: ChatCompletionMessageParam[],
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

    // Method for streaming chat completions
    public async createStreamingChatCompletion(
        messages: ChatCompletionMessageParam[],
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
