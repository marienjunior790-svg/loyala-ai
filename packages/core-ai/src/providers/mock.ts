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
  catalog:
    '{"currency":"XOF","categories":[{"name":"Entrées","description":"Pour commencer","items":[{"name":"Salade maison","description":"Fraîcheur du jour","price":2500,"type":"product"},{"name":"Nems poulet","description":"4 pièces croustillantes","price":3000,"type":"product"},{"name":"Soupe du jour","description":"Recette du chef","price":2000,"type":"product"},{"name":"Beignets de crevettes","description":"Sauce aigre-douce","price":3500,"type":"product"}]},{"name":"Plats","description":"Spécialités","items":[{"name":"Poulet braisé","description":"Mariné aux épices","price":5500,"type":"product"},{"name":"Poisson grillé","description":"Selon arrivage","price":6500,"type":"product"},{"name":"Riz sauce arachide","description":"Classique maison","price":4500,"type":"product"},{"name":"Frites + steak","description":"200g, sauce au choix","price":6000,"type":"product"}]},{"name":"Desserts","description":"Pour finir","items":[{"name":"Tiramisu","description":"Maison","price":2500,"type":"product"},{"name":"Salade de fruits","description":"Fruits de saison","price":2000,"type":"product"},{"name":"Mousse au chocolat","description":"Intense","price":2500,"type":"product"},{"name":"Glace 2 boules","description":"Parfums du jour","price":1500,"type":"product"}]},{"name":"Boissons","description":"Fraîches et chaudes","items":[{"name":"Jus bissap","description":"Maison 33cl","price":1000,"type":"product"},{"name":"Coca-Cola","description":"33cl","price":800,"type":"product"},{"name":"Eau minérale","description":"50cl","price":500,"type":"product"},{"name":"Café expresso","description":"Serré","price":700,"type":"product"}]}]}',
};

function resolveMockJson(params: AICompletionParams): string {
  const text = `${params.system} ${params.user}`.toLowerCase();
  if (text.includes('catalogue') || text.includes('catalog') || text.includes('catégories et articles'))
    return MOCK_RESPONSES.catalog;
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
