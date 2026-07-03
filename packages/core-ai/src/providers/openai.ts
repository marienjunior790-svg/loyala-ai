import type { AIProvider, AICompletionParams, AIProviderResult } from '../types/index';
import { getModelForProvider } from '../models';

export function createOpenAIProvider(apiKey: string): AIProvider {
  return {
    id: 'openai',
    async complete(params: AICompletionParams): Promise<AIProviderResult> {
      const model = getModelForProvider('openai');
      const body: Record<string, unknown> = {
        model: model.id,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
      };

      if (params.jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        choices: { message: { content: string } }[];
        usage: { prompt_tokens: number; completion_tokens: number };
        model: string;
      };

      return {
        content: data.choices[0]?.message?.content ?? '',
        model: data.model,
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        },
      };
    },
  };
}
