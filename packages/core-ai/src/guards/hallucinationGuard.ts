export interface HallucinationGuardInput {
  content: string;
  allowedFacts: string[];
  minConfidence?: number;
}

export interface HallucinationGuardResult {
  safe: boolean;
  reasons: string[];
  confidence: number;
}

export function checkHallucinations(input: HallucinationGuardInput): HallucinationGuardResult {
  const reasons: string[] = [];
  const content = input.content.toLowerCase();
  const minConfidence = input.minConfidence ?? 0.6;

  const phonePattern = /\+?\d[\d\s]{8,}/g;
  const inventedPhones = (input.content.match(phonePattern) ?? []).filter(
    (p) => !input.allowedFacts.some((f) => f.includes(p.replace(/\s/g, '')))
  );
  if (inventedPhones.length > 0) {
    reasons.push('invented_phone_number');
  }

  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const inventedIds = (input.content.match(uuidPattern) ?? []).filter(
    (id) => !input.allowedFacts.some((f) => f.includes(id))
  );
  if (inventedIds.length > 0) {
    reasons.push('invented_identifier');
  }

  const hedgePhrases = ['je ne sais pas', "i don't know", "pas d'information", 'uncertain'];
  const hasHedge = hedgePhrases.some((h) => content.includes(h));

  const confidence = hasHedge ? 0.5 : reasons.length === 0 ? 0.95 : 0.3;
  const safe = reasons.length === 0 && confidence >= minConfidence;

  return { safe, reasons, confidence };
}

export function hallucinationGuard<T extends { text: string }>(
  response: T,
  allowedFacts: string[] = []
): T {
  const guard = checkHallucinations({ content: response.text, allowedFacts });
  assertSafeResponse(guard);
  return response;
}

export function assertSafeResponse(result: HallucinationGuardResult): void {
  if (!result.safe) {
    throw new Error(
      `[core-ai] Hallucination guard blocked response: ${result.reasons.join(', ')}`
    );
  }
}
