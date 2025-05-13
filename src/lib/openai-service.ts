import OpenAI from 'openai';

class OpenAIService {
    private static instance: OpenAIService;
    private client: OpenAI;

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

    // Example method for making completions
    public async createCompletion(prompt: string): Promise<string> {
        try {
            const completion = await this.client.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-3.5-turbo",
            });

            return completion.choices[0]?.message?.content || '';
        } catch (error) {
            console.error('Error creating completion:', error);
            throw error;
        }
    }
}

export default OpenAIService;
