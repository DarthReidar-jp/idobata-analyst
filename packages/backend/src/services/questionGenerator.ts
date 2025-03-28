import OpenAI from 'openai';
import { questionPrompts } from '../config/prompts';

export interface GeneratedQuestion {
    text: string;
    stances: { name: string }[];
}

export class QuestionGenerator {
    private openai: OpenAI;
    private lastRequestTime: number = 0;
    private readonly MIN_DELAY_MS: number = 1000; // 1秒の最小遅延

    constructor(apiKey: string) {
        this.openai = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: apiKey,
        });
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.MIN_DELAY_MS) {
            const delayTime = this.MIN_DELAY_MS - timeSinceLastRequest;
            await this.delay(delayTime);
        }
        
        this.lastRequestTime = Date.now();
    }

    private async parseResponse(response: string): Promise<GeneratedQuestion[]> {
        try {
            const cleaned = response.replace(/```json|```/g, '').trim();
            const result = JSON.parse(cleaned);
            return result.questions;
        } catch (error) {
            console.error('Failed to parse Gemini response:', error);
            return [];
        }
    }

    async generateQuestions(comments: string[], customPrompt?: string): Promise<GeneratedQuestion[]> {
        try {
            const prompt = questionPrompts.questionGeneration(comments, customPrompt);
            console.log('Generated Prompt:', prompt);
            
            await this.enforceRateLimit();
            console.log('Sending prompt to LLM...');
            
            const completion = await this.openai.chat.completions.create({
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            });
            
            const response = completion.choices[0].message.content || '';
            console.log('LLM Response:', response);
            
            return this.parseResponse(response);
        } catch (error) {
            console.error('Question generation failed:', error);
            return [];
        }
    }
}