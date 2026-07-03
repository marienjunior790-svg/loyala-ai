import type { AIProvider, AICompletionParams, AIProviderResult } from '../types/index';

const MOCK_RESPONSES: Record<string, string> = {
  classify:
    '{"intent":"question","sentiment":"neutral","priority":"medium","summary":"Demande info horaires"}',
  inactive:
    '{"urgency":"high","winBackMessage":"On vous attend avec une offre spéciale !","channel":"whatsapp"}',
  birthday:
    '{"message":"Joyeux anniversaire ! -15% sur votre prochain repas chez nous.","emoji":"🎂","sendWindow":"midi"}',
  loyalty:
    '{"message":"Vous avez des points en attente ! Passez nous voir cette semaine.","incentive":"Dessert offert","urgency":"medium"}',
  promotion:
    '{"promotions":[{"title":"Happy Hour","description":"-20% 17h-19h en semaine","targetSegment":"regular","expectedLift":"+12%"}]}',
  reply:
    '{"reply":"Merci pour votre message ! Nous vous répondons sous 24h.","tone":"friendly","needsHumanReview":false}',
  segment:
    '{"segment":"regular","confidence":0.92,"action":"Campagne fidélité","reason":"RFM stable"}',
};

function resolveMockJson(params: AICompletionParams): string {
  const text = `${params.system} ${params.user}`.toLowerCase();
  if (text.includes('classif')) return MOCK_RESPONSES.classify;
  if (text.includes('inactif')) return MOCK_RESPONSES.inactive;
  if (text.includes('anniversaire')) return MOCK_RESPONSES.birthday;
  if (text.includes('fidélité') || text.includes('loyalty') || text.includes('relance'))
    return MOCK_RESPONSES.loyalty;
  if (text.includes('promotion')) return MOCK_RESPONSES.promotion;
  if (text.includes('réponse') || text.includes('reply')) return MOCK_RESPONSES.reply;
  return MOCK_RESPONSES.segment;
}

/** Deterministic mock for tests and offline dev */
export function createMockProvider(responses?: Record<string, string>): AIProvider {
  return {
    id: 'mock',
    async complete(params: AICompletionParams): Promise<AIProviderResult> {
      const content = params.jsonMode
        ? (responses?.[params.user.slice(0, 40)] ?? resolveMockJson(params))
        : 'Mock AI response';

      return {
        content,
        model: 'mock-model',
        usage: { inputTokens: 50, outputTokens: 30 },
      };
    },
  };
}
