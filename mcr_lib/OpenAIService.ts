import type { ChatCompletionMessageParam } from 'ai/prompts';
import OpenAI, { toFile } from 'openai';
import type { ChatCompletionParseParams } from 'openai/resources/beta/chat/completions';
import type { ChatCompletion, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { CreateEmbeddingResponse } from 'openai/resources/embeddings';

export interface OpenAIOptions {
    model?: string;
    max_tokens?: number;
    temperature?: number;
    tools?: ChatCompletionTool[];
}

export class OpenAIService {
    private openai: OpenAI;
    private readonly JINA_API_KEY = process.env.JINA_API_KEY;

    constructor() {
        this.openai = new OpenAI();
    }

    async send(message: string, context?: ChatCompletionMessageParam[], options?: OpenAIOptions): Promise<string | ChatCompletion.Choice> {
        const ctx = context ?? [];
        const messages: ChatCompletionMessageParam[] = [
            ...ctx,
            { role: 'user', content: message }
        ];

        try {
            const chatCompletionParams = {
                messages,
                model: options?.model ?? 'gpt-4o-mini',
                temperature: options?.temperature ?? 0.5,
            } as ChatCompletionParseParams;

            if (options?.tools) {
                chatCompletionParams.tools = options.tools;
            }

            if (options?.max_tokens) {
                chatCompletionParams.max_tokens = options.max_tokens;
            }

            const chatCompletion = await this.openai.chat.completions.create(chatCompletionParams)

            if (options?.tools) {
;               return chatCompletion.choices[0] as ChatCompletion.Choice;
            } else {
                return chatCompletion.choices[0].message.content?.trim() as string;
            }
        } catch (error) {
            console.error('Error in OpenAI completion:', error);
            return '';
        }
    }

    async generateImage(prompt: string): Promise<string> {
        const response = await this.openai.images.generate({
            model: 'dall-e-3',
            prompt,
            size: '1024x1024',
            quality: 'standard',
            n: 1,
        });

        return response.data[0].url ?? '';
    }

    async transcribe(audioBuffer: Buffer, name: string): Promise<string> {
        const transcription = await this.openai.audio.transcriptions.create({
              file: await toFile(audioBuffer, name),
              language: 'pl',
              model: 'whisper-1',
        });

        return transcription.text;
    }

    async createEmbedding(text: string): Promise<number[]> {
        try {
            const response: CreateEmbeddingResponse = await this.openai.embeddings.create({
                model: "text-embedding-3-large",
                input: text,
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error("Error creating embedding:", error);
            throw error;
        }
    }

    async createJinaEmbedding(text: string): Promise<number[]> {
        try {
            const response = await fetch('https://api.jina.ai/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.JINA_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'jina-embeddings-v3',
                    task: 'text-matching',
                    dimensions: 1024,
                    late_chunking: false,
                    embedding_type: 'float',
                    input: [text]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.data[0].embedding;
        } catch (error) {
            console.error("Error creating Jina embedding:", error);
            throw error;
        }
    }
}
