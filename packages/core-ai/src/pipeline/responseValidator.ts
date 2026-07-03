import { z } from 'zod';
import type { z as ZodType } from 'zod';
import type { AIProviderResult, ValidatedAIOutput } from '../types';

export class JSONValidationError extends Error {
  constructor(
    message: string,
    public readonly rawContent: string
  ) {
    super(message);
    this.name = 'JSONValidationError';
  }
}

const baseResponseSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export function parseJSONString<T>(content: string, schema: ZodType.ZodType<T>): T {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, trimmed];
  const jsonStr = (jsonMatch[1] ?? trimmed).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new JSONValidationError('Invalid JSON in AI response', content);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new JSONValidationError(
      `Schema validation failed: ${result.error.message}`,
      content
    );
  }

  return result.data;
}

export function validateResponse(
  result: AIProviderResult,
  jsonSchema?: ZodType.ZodType
): ValidatedAIOutput {
  let parsed: unknown;
  let confidence = 0.85;

  if (jsonSchema) {
    parsed = parseJSONString(result.content, jsonSchema);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'confidence' in parsed &&
      typeof (parsed as { confidence: unknown }).confidence === 'number'
    ) {
      confidence = (parsed as { confidence: number }).confidence;
    }
  } else {
    try {
      const json = JSON.parse(result.content);
      const base = baseResponseSchema.safeParse({ text: result.content, ...json });
      if (base.success && base.data.confidence !== undefined) {
        confidence = base.data.confidence;
      }
      parsed = json;
    } catch {
      parsed = undefined;
    }
  }

  return {
    text: result.content,
    confidence,
    raw: result.content,
    parsed,
  };
}

export const parseJSONResponse = parseJSONString;
