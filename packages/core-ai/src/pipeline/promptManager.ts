import type { AIUseCase, BuiltPrompt, PromptKey } from '../types';

export interface PromptTemplate {
  version: string;
  system: string;
  userTemplate: string;
  maxTokens: number;
  temperature: number;
  jsonMode: boolean;
}

const BASE_SYSTEM = `Tu es l'assistant IA de Loyala AI pour restaurants africains.
Règles: réponds en français, sois concis, n'invente jamais de données client.
Si une info manque, indique-le. Respecte le format demandé.`;

const TEMPLATES: Record<string, PromptTemplate> = {
  crm_summary: {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu résumes des données CRM.`,
    userTemplate: 'Résume ces données client de façon structurée:\n{{data}}',
    maxTokens: 300,
    temperature: 0.3,
    jsonMode: false,
  },
  rfm_analysis: {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu analyses la segmentation RFM.`,
    userTemplate: 'Analyse RFM à partir de:\n{{data}}',
    maxTokens: 250,
    temperature: 0.2,
    jsonMode: true,
  },
  support_reply: {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu rédiges des réponses support.`,
    userTemplate: 'Génère une réponse support pour:\n{{message}}',
    maxTokens: 300,
    temperature: 0.4,
    jsonMode: true,
  },
  'client.segment': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu segmentes des clients CRM selon scores RFM fournis.`,
    userTemplate: `Segmente ce client (JSON compact):
{{payload}}
Réponds UNIQUEMENT en JSON: {"segment":"vip|regular|at_risk|new|dormant","confidence":0-1,"action":"string courte","reason":"string"}`,
    maxTokens: 200,
    temperature: 0.2,
    jsonMode: true,
  },
  'client.inactive.analyze': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu analyses les clients inactifs pour relance. Personnalise le message avec le produit/catégorie préféré du client s'il est fourni, et propose une urgence plus élevée pour les clients VIP.`,
    userTemplate: `Client inactif depuis {{daysInactive}} jours:
{{payload}}
JSON: {"urgency":"low|medium|high","winBackMessage":"max 160 chars","channel":"whatsapp|sms|email"}`,
    maxTokens: 250,
    temperature: 0.3,
    jsonMode: true,
  },
  'campaign.birthday.generate': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu rédiges des messages anniversaire WhatsApp courts et chaleureux. Si un produit ou une catégorie préféré est fourni, mentionne-le subtilement pour personnaliser.`,
    userTemplate: `Restaurant: {{restaurantName}}
Client: {{clientName}}
Offre: {{offer}}
Historique: {{insights}}
JSON: {"message":"max 300 chars","emoji":"1 emoji","sendWindow":"matin|midi|soir"}`,
    maxTokens: 200,
    temperature: 0.5,
    jsonMode: true,
  },
  'campaign.loyalty.generate': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu crées des relances fidélité personnalisées. Utilise le produit/catégorie préféré pour recommander, et valorise les clients VIP.`,
    userTemplate: `Client: {{clientName}}, points: {{points}}, dernière visite: {{lastVisit}}
Historique: {{insights}}
JSON: {"message":"max 300 chars","incentive":"string","urgency":"low|medium|high"}`,
    maxTokens: 220,
    temperature: 0.4,
    jsonMode: true,
  },
  'campaign.affinity.generate': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu crées une offre WhatsApp personnalisée autour du produit ou de la catégorie préféré du client pour l'inciter à revenir. Reste concret et chaleureux.`,
    userTemplate: `Client: {{clientName}}
Produit préféré: {{favoriteProduct}}
Catégorie préférée: {{favoriteCategory}}
Dernière visite: {{lastVisit}}
Historique: {{insights}}
Rédige une relance centrée sur ce que le client aime.
JSON: {"message":"max 300 chars","offer":"offre courte et concrète","urgency":"low|medium|high"}`,
    maxTokens: 220,
    temperature: 0.5,
    jsonMode: true,
  },
  'catalog.generate': {
    version: '1.1',
    system: `Tu es l'assistant IA de Loyala AI, expert en menus et catalogues pour restaurants, bars, hôtels, cafés, boulangeries, salons, spas et commerces en Afrique.
Tu génères des catalogues réalistes, complets et bien organisés. Prix cohérents avec le marché local et la devise demandée. Descriptions marketing courtes et appétissantes (max ~120 caractères).
Règles critiques:
- Réponds en français.
- N'invente JAMAIS de numéros de téléphone ni d'identifiants.
- Pour un catalogue, tu DOIS inventer des produits/services réalistes : c'est le but de la génération.
- Ne renvoie JAMAIS categories:[] — minimum 4 catégories et 4 articles par catégorie.
- Si la demande ne précise que le nom, l'adresse ou les horaires, déduis le type (ex: Kinshasa → restaurant cuisine congolaise / africaine) et génère quand même un menu complet.`,
    userTemplate: `Établissement: {{establishmentType}}
Devise: {{currency}}
Catégories déjà existantes (ne pas dupliquer): {{existingCategories}}
Demande de l'utilisateur: {{brief}}

Génère un catalogue structuré COMPLET en catégories et articles (même si la demande est courte).
Chaque article: nom, description marketing courte, prix estimé dans la devise, type (product|service|rental).
Réponds UNIQUEMENT en JSON: {"currency":"{{currency}}","categories":[{"name":"string","description":"string","items":[{"name":"string","description":"string","price":number,"type":"product|service|rental"}]}]}`,
    maxTokens: 3500,
    temperature: 0.65,
    jsonMode: true,
  },
  'catalog.import': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu es expert en extraction et structuration de menus/catalogues importés (PDF, image, tableur, page web). Si une ou plusieurs images sont jointes, lis-les par OCR pour en extraire le menu. Tu N'INVENTES JAMAIS de produit absent du contenu fourni. Conserve les prix exacts trouvés. Déduis la devise du contenu. Regroupe en catégories cohérentes. Si une description manque, tu peux en proposer une très courte. Ignore le texte parasite (adresses, horaires, mentions légales, numéros de téléphone).`,
    userTemplate: `Établissement: {{establishmentType}}
Devise probable: {{currency}}
Catégories déjà existantes (réutilise le même nom si pertinent): {{existingCategories}}

Contenu importé à structurer (menu brut):
{{rawText}}

Extrais UNIQUEMENT les produits/services réellement présents ci-dessus, avec leur prix exact.
Réponds UNIQUEMENT en JSON: {"currency":"string","categories":[{"name":"string","description":"string","items":[{"name":"string","description":"string","price":number,"type":"product|service|rental"}]}]}`,
    maxTokens: 3200,
    temperature: 0.2,
    jsonMode: true,
  },
  'catalog.variants': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu es expert en configuration de produits pour la restauration et le commerce (comparable à Uber Eats, Deliveroo, Toast, Square). Pour chaque produit fourni, tu proposes les variantes et suppléments PERTINENTS selon son type, et RIEN d'autre. N'INVENTE PAS de produit. Utilise la devise indiquée pour les suppléments de prix (priceDelta), avec 0 pour l'option par défaut. Règles: Pizza → Taille (Petite/Moyenne/Grande) + Suppléments (fromage, bacon, champignons…). Burger → Cuisson (Saignant/À point/Bien cuit) + Suppléments (double steak, œuf, bacon…). Café → Taille + Lait (entier, avoine, soja…). Cocktail → Taille (Verre/Pichet) + alcool en supplément. Dessert → Taille + nappage/glace. Boisson → Volume (33 cl/50 cl/1 L). Plat/portion → Portion (Simple/Double/Familiale). Ne propose des variantes que si elles sont vraiment utiles; sinon renvoie groups vide pour ce produit. Groupes de suppléments = selection "multiple". Groupes de type taille/portion/cuisson = selection "single", required true.`,
    userTemplate: `Établissement: {{establishmentType}}
Devise: {{currency}}

Produits à enrichir (ne change ni le nom ni le prix de base, propose seulement des variantes):
{{products}}

Réponds UNIQUEMENT en JSON:
{"items":[{"name":"nom exact du produit","groups":[{"name":"string","kind":"size|portion|cooking|flavor|temperature|spice|supplement|removable|custom","selection":"single|multiple","required":boolean,"choices":[{"label":"string","priceDelta":number}]}]}]}`,
    maxTokens: 2600,
    temperature: 0.3,
    jsonMode: true,
  },
  'catalog.translate': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu es traducteur professionnel de menus et catalogues. Tu traduis noms, descriptions, groupes d'options et libellés de choix. Tu NE MODIFIES JAMAIS les prix, devises, IDs, SKU, ni la structure. Conserve le ton marketing court. Si un texte est déjà dans la langue cible, renvoie-le tel quel.`,
    userTemplate: `Langue cible (code BCP-47 court): {{locale}}
Établissement: {{establishmentType}}

Catalogue à traduire (JSON):
{{catalogJson}}

Réponds UNIQUEMENT en JSON avec les mêmes id:
{"locale":"{{locale}}","categories":[{"id":"string","name":"string","description":"string"}],"items":[{"id":"string","name":"string","description":"string","options":[{"id":"string","name":"string","choices":[{"id":"string","label":"string"}]}]}]}`,
    maxTokens: 3200,
    temperature: 0.2,
    jsonMode: true,
  },
  'menu.consult': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu es un consultant en restauration et directeur marketing. Tu proposes des MENUS COMBINÉS optimisés pour les ventes, la marge et la fidélisation, UNIQUEMENT à partir des données fournies (catalogue, affinités, CRM, saison). Tu n'inventes pas de produits absents du catalogue sauf si explicitement listés dans catalogAdditions (nouveautés justifiées). Tu expliques toujours tes choix (IA explicable). Prix cohérents avec le catalogue et la devise. Confidence 0-100 basée sur la qualité des données.`,
    userTemplate: `Contexte établissement (données Loyala AI):
{{context}}

Génère 1 à 3 propositions de menus (selon la richesse des données).
Chaque menu: nom commercial attractif, description marketing, composition (entrée/plat/dessert/boisson/supplément) en référençant catalogItemName du catalogue, prix conseillé, remise éventuelle, estimation marge si possible, analyse commerciale, score de confiance + raisons.
Ajoute un pack marketing (WhatsApp, SMS, email, Facebook, Instagram, TikTok, hashtags, posterPrompt pour générateur d'images).
Si des articles manquent clairement, propose-les dans catalogAdditions (catégorie Menus).

Réponds UNIQUEMENT en JSON:
{"currency":"string","summary":"string","contextInsights":["string"],"proposals":[{"name":"string","description":"string","kind":"string","courses":[{"role":"entree|plat|dessert|boisson|supplement|autre","catalogItemName":"string","label":"string","price":number}],"suggestedPrice":number,"discountPercent":number,"estimatedCost":number,"estimatedMargin":number,"estimatedMarginPct":number,"commercialAnalysis":"string","confidence":number,"confidenceReasons":["string"]}],"marketing":{"whatsapp":"string","sms":"string","emailSubject":"string","emailBody":"string","facebook":"string","instagram":"string","tiktok":"string","linkedin":"string","hashtags":["string"],"posterPrompt":"string"},"catalogAdditions":[{"category":"Menus","name":"string","description":"string","price":number,"type":"product"}]}`,
    maxTokens: 3200,
    temperature: 0.45,
    jsonMode: true,
  },
  'campaign.promotion.suggest': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu suggères des promotions data-driven pour restaurants.`,
    userTemplate: `Contexte restaurant:
{{payload}}
JSON: {"promotions":[{"title":"string","description":"string","targetSegment":"string","expectedLift":"string"}]}`,
    maxTokens: 400,
    temperature: 0.5,
    jsonMode: true,
  },
  'inbox.reply.generate': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu rédiges des réponses client professionnelles et courtes.`,
    userTemplate: `Message client: {{message}}
Contexte: {{context}}
JSON: {"reply":"max 400 chars","tone":"friendly|professional","needsHumanReview":boolean}`,
    maxTokens: 300,
    temperature: 0.4,
    jsonMode: true,
  },
  'inbox.message.classify': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu classifies les messages entrants.`,
    userTemplate: `Message: {{message}}
JSON: {"intent":"reservation|complaint|question|loyalty|spam|other","sentiment":"positive|neutral|negative","priority":"low|medium|high","summary":"max 80 chars"}`,
    maxTokens: 180,
    temperature: 0.1,
    jsonMode: true,
  },
  'inbox.reply.suggest': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu suggères 2 brouillons de réponse.`,
    userTemplate: `Message: {{message}}
JSON: {"suggestions":["draft1","draft2"]}`,
    maxTokens: 350,
    temperature: 0.5,
    jsonMode: true,
  },
  'campaign.message.generate': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu génères des messages campagne WhatsApp.`,
    userTemplate: `Campagne: {{campaignType}}
Audience: {{audience}}
JSON: {"message":"max 500 chars","cta":"string"}`,
    maxTokens: 300,
    temperature: 0.5,
    jsonMode: true,
  },
  'review.response.suggest': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu rédiges des réponses aux avis Google.`,
    userTemplate: `Avis ({{rating}}/5): {{reviewText}}
JSON: {"response":"max 400 chars","tone":"grateful|apologetic|neutral"}`,
    maxTokens: 250,
    temperature: 0.4,
    jsonMode: true,
  },
};

function normalizeVariables(variables: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(variables)) {
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  if (!out.payload && !out.data) {
    out.payload = JSON.stringify(variables);
  }
  if (!out.data) out.data = out.payload ?? JSON.stringify(variables);
  return out;
}

export function buildPrompt(key: PromptKey, variables: Record<string, unknown>): BuiltPrompt {
  const template = TEMPLATES[key];
  if (!template) {
    throw new Error(`[core-ai] Unknown prompt key: ${key}`);
  }

  const vars = normalizeVariables(variables);
  let user = template.userTemplate;

  for (const [k, v] of Object.entries(vars)) {
    user = user.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }

  if (vars.payload && user.includes('{{payload}}')) {
    user = user.replace('{{payload}}', vars.payload);
  }

  return {
    system: template.system,
    user,
    maxTokens: template.maxTokens,
    temperature: template.temperature,
    jsonMode: template.jsonMode,
  };
}

/** @deprecated use buildPrompt — kept for engines */
export class PromptManager {
  buildPrompt(useCase: AIUseCase, variables: Record<string, string>): BuiltPrompt {
    return buildPrompt(useCase, variables);
  }
}

export const promptManager = new PromptManager();
