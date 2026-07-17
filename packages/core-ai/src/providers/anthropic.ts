import type { AIProvider, AICompletionParams, AIProviderResult } from '../types/index';
import { getModelForProvider } from '../models';

export function createAnthropicProvider(apiKey: string): AIProvider {
  return {
    id: 'anthropic',
    async complete(params: AICompletionParams): Promise<AIProviderResult> {
      const model = getModelForProvider('anthropic');
      const userContent =
        params.images && params.images.length > 0
          ? [
              { type: 'text' as const, text: params.user },
              ...params.images.map((dataUrl) => {
                const match = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
                const mediaType = match?.[1] ?? 'image/jpeg';
                const data = match?.[2] ?? dataUrl;
                return {
                  type: 'image' as const,
                  source: { type: 'base64' as const, media_type: mediaType, data },
                };
              }),
            ]
          : params.user;
      const body = {
        model: model.id,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        system: params.system + (params.jsonMode ? '\nRespond with valid JSON only.' : ''),
        messages: [{ role: 'user' as const, content: userContent }],
      };

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic API error ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        content: { type: string; text: string }[];
        usage: { input_tokens: number; output_tokens: number };
        model: string;
      };

      const text = data.content.find((c) => c.type === 'text')?.text ?? '';

      return {
        content: text,
        model: data.model,
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        },
      };
    },
  };
}
