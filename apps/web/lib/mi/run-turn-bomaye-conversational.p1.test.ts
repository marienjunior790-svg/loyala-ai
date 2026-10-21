/**
 * P1 — Validation conversationnelle Bomaye V2.
 * Parcours réel : message → detectMiIntent → parse → evaluateBomayeAdvisor → formatBomayeAdvisorAnswer.
 * Données synthétiques uniquement. Aucun LLM requis (skippedAi).
 * Pas d’injection bomayeSignals sauf scénario isolation (contrôle org).
 */
import { describe, expect, it } from 'vitest';
import type { MiOrgInsights } from '@loyala/domain-crm';
import { detectMiIntent, runMiChatTurn } from './run-turn';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function synthInsights(
  orgId: string,
  overrides?: Partial<MiOrgInsights>
): MiOrgInsights {
  const period = {
    code: 'mois' as const,
    label: 'Mois',
    from: '2026-10-01',
    to: '2026-10-18',
    definition: 'Synthétique P1 — pas un restaurant réel.',
  };
  const base: MiOrgInsights = {
    organizationId: orgId,
    restaurantName: 'Resto Synthétique P1',
    timezone: 'Africa/Brazzaville',
    currency: 'XAF',
    period,
    dataQuality: 'partial',
    limits: ['Données synthétiques de validation P1.'],
    kpis: null,
    topClients: [],
    topProducts: [],
    topCategories: [],
    segments: null,
    inactiveLoyal: [],
    clientCount: 0,
    trends: null,
    opportunities: [],
    customerIntelligence: {
      period: { ...period },
      dataQuality: 'partial',
      metrics: [],
      segments: null,
      medianRecencyDays: null,
    },
    retentionStrategies: [],
    campaignProposals: [],
    channelMix: null,
    reviewsInsight: null,
    recencyLoyalty: null,
    campaignActivity: null,
    measurementWindows: [],
  };
  return {
    ...base,
    ...overrides,
    organizationId: orgId,
    period: overrides?.period ?? period,
  };
}

type ScenarioEvidence = {
  id: string;
  question: string;
  intent: string;
  clientCount: number;
  skippedAi: boolean;
  fires: Array<{ ruleId: string; priority: string; strategies: string[] }>;
  primaryStrategies: string[];
  missingInformation: string[];
  observedFacts: string[];
  answer: string;
  knowledgeDocumentId?: string;
  checks: Record<string, boolean>;
  result: 'PASS' | 'FAIL' | 'BLOCKED';
  failReasons: string[];
};

const evidence: ScenarioEvidence[] = [];

async function runScenario(input: {
  id: string;
  question: string;
  orgId?: string;
  clientCount?: number;
  expectIntent?: string;
  expectFires?: string[];
  expectStrategies?: string[];
  answerMustMatch?: RegExp[];
  answerMustNotMatch?: RegExp[];
  checks?: (ctx: {
    answer: string;
    fires: string[];
    missing: string[];
    strategies: string[];
  }) => Record<string, boolean>;
}): Promise<ScenarioEvidence> {
  const orgId = input.orgId ?? `org-p1-${input.id}`;
  const turn = await runMiChatTurn({
    supabase: {} as never,
    organizationId: orgId,
    userId: 'user-p1-synth',
    message: input.question,
    loadInsights: async () => synthInsights(orgId, { clientCount: input.clientCount ?? 0 }),
    // Aucun bomayeSignals — preuve du parse message.
  });

  const failReasons: string[] = [];
  if (!turn.ok) {
    const blocked: ScenarioEvidence = {
      id: input.id,
      question: input.question,
      intent: 'error',
      clientCount: input.clientCount ?? 0,
      skippedAi: false,
      fires: [],
      primaryStrategies: [],
      missingInformation: [],
      observedFacts: [],
      answer: turn.message,
      checks: {},
      result: 'FAIL',
      failReasons: [`turn failed: ${turn.code} ${turn.message}`],
    };
    evidence.push(blocked);
    return blocked;
  }

  const advisor = turn.insights.bomayeAdvisor as
    | {
        fires?: Array<{ ruleId: string; priority: string; strategies: string[] }>;
        primaryStrategies?: string[];
        missingInformation?: string[];
        observedFacts?: string[];
      }
    | undefined;
  const fires = advisor?.fires ?? [];
  const fireIds = fires.map((f) => f.ruleId);
  const strategies = advisor?.primaryStrategies ?? [];
  const missing = advisor?.missingInformation ?? [];
  const refs = turn.insights.knowledgeRefs as { documentId?: string } | undefined;

  if (input.expectIntent && turn.intent !== input.expectIntent) {
    failReasons.push(`intent=${turn.intent} expected ${input.expectIntent}`);
  }
  if (!turn.meta.skippedAi) {
    failReasons.push('LLM was called — expected deterministic Bomaye path');
  }
  for (const rule of input.expectFires ?? []) {
    if (!fireIds.includes(rule)) failReasons.push(`missing fire ${rule}`);
  }
  for (const sid of input.expectStrategies ?? []) {
    if (!strategies.includes(sid)) failReasons.push(`missing strategy ${sid}`);
  }
  for (const re of input.answerMustMatch ?? []) {
    if (!re.test(turn.answer)) failReasons.push(`answer missing /${re.source}/`);
  }
  for (const re of input.answerMustNotMatch ?? []) {
    if (re.test(turn.answer)) failReasons.push(`answer forbidden /${re.source}/`);
  }

  const extra = input.checks?.({
    answer: turn.answer,
    fires: fireIds,
    missing,
    strategies,
  }) ?? {};
  for (const [k, v] of Object.entries(extra)) {
    if (!v) failReasons.push(`check failed: ${k}`);
  }

  const row: ScenarioEvidence = {
    id: input.id,
    question: input.question,
    intent: turn.intent,
    clientCount: input.clientCount ?? 0,
    skippedAi: turn.meta.skippedAi,
    fires: fires.map((f) => ({
      ruleId: f.ruleId,
      priority: f.priority,
      strategies: f.strategies,
    })),
    primaryStrategies: strategies,
    missingInformation: missing,
    observedFacts: advisor?.observedFacts ?? [],
    answer: turn.answer,
    knowledgeDocumentId: refs?.documentId,
    checks: {
      skippedAi: turn.meta.skippedAi,
      hasBomayeAdvisor: Boolean(advisor),
      hasKnowledgeRefs: Boolean(refs?.documentId),
      ...extra,
    },
    result: failReasons.length ? 'FAIL' : 'PASS',
    failReasons,
  };
  evidence.push(row);
  return row;
}

describe('P1 conversational Bomaye — 9 scénarios métier (message only)', () => {
  it('S1 — baisse fréquentation + baisse prix générale', async () => {
    const row = await runScenario({
      id: 'S1',
      question:
        'On observe une baisse de fréquentation de 15 %. On envisage une réduction générale des prix de 20 %. Que recommandez-vous ?',
      expectIntent: 'knowledge',
      expectFires: ['CASE-PRICE-CUT'],
      expectStrategies: ['STRAT-08'],
      answerMustMatch: [/baisse générale|ne pas recommander/i, /Bomaye|sentimier|drop|WhatsApp/i],
      answerMustNotMatch: [
        /je (vous )?recommande (de )?baisser (vos |les )?prix (de |d['’])?20/i,
        /message a été envoyé|campagne lancée avec succès|WhatsApp a été envoyé/i,
      ],
      checks: ({ answer }) => ({
        refusesGeneralCut: /ne pas|contre-indication|baisse générale/i.test(answer),
        sourceNotUniversalLaw: /source Bomaye|Bomaye|pas une garantie universelle/i.test(answer),
      }),
    });
    expect(row.result).toBe('PASS');
  });

  it('S2 — dépendance livraison 45 %', async () => {
    const row = await runScenario({
      id: 'S2',
      question:
        'Nous réalisons 45 % de notre chiffre d’affaires sur les plateformes de livraison (Uber Eats) et nous avons des difficultés de rentabilité. Que faire ?',
      clientCount: 12,
      expectIntent: 'knowledge',
      expectFires: ['REGLE-DEC-01'],
      expectStrategies: ['STRAT-05'],
      answerMustMatch: [/livraison|STRAT-05|plafonn/i],
      answerMustNotMatch: [/message a été envoyé|campagne lancée avec succès/i],
      checks: ({ answer, fires }) => ({
        mentionsCommissionOrCap: /commission|10\s*%|15\s*%|plafonn|salle|agrégateur/i.test(
          answer
        ),
        ruleFired: fires.includes('REGLE-DEC-01'),
        notFalseFullFinanceDiag: !/diagnostic financier complet (est |a été )?établi/i.test(
          answer
        ),
      }),
    });
    expect(row.result).toBe('PASS');
  });

  it('S3 — faible fidélisation / taux de retour', async () => {
    const row = await runScenario({
      id: 'S3',
      question:
        'Notre taux de retour est faible (environ 12 %). Les clients ne reviennent pas. Est-ce un problème de produit ou de marketing ?',
      clientCount: 40,
      expectIntent: 'knowledge',
      expectFires: ['REGLE-DEC-02'],
      answerMustMatch: [/produit|avis|réactivation|Drop|fidél/i],
      checks: ({ answer, missing }) => ({
        distinguishesProductVsMarketing: /produit|avis|qualité/i.test(answer),
        asksOrNotesMissing:
          missing.length > 0 || /manquant|avis|note moyenne/i.test(answer),
      }),
    });
    expect(row.result).toBe('PASS');
  });

  it('S4 — Food Cost > 32 %', async () => {
    const row = await runScenario({
      id: 'S4',
      question:
        'Notre Food Cost dépasse 32 %. Dois-je réduire la taille des portions pour sauver la marge ?',
      clientCount: 20,
      expectIntent: 'knowledge',
      expectFires: ['REGLE-DEC-03'],
      expectStrategies: ['STRAT-08'],
      answerMustMatch: [/Food Cost|fiches techniques|shrinkflation|portions/i],
      answerMustNotMatch: [
        /réduisez (secrètement )?les portions|baisser les portions en cachette/i,
      ],
      checks: ({ answer }) => ({
        forbidsShrinkflation: /shrinkflation|Ne pas :.*portion|jamais shrinkflation|secrètement/i.test(
          answer
        ),
      }),
    });
    expect(row.result).toBe('PASS');
  });

  it('S5 — préouverture', async () => {
    const row = await runScenario({
      id: 'S5',
      question:
        'Notre établissement est en pré-ouverture : on ouvre dans plusieurs mois. Quelle stratégie d’audience avant l’ouverture ?',
      expectIntent: 'knowledge',
      expectFires: ['CASE-PREOPEN'],
      expectStrategies: ['STRAT-02'],
      answerMustMatch: [/préouverture|Pre-Launch|audience|genèse|STRAT-02|document/i],
    });
    expect(row.result).toBe('PASS');
  });

  it('S6 — aucune base de contacts', async () => {
    const row = await runScenario({
      id: 'S6',
      question:
        'Nous n’avons aucune base de contacts exploitable. Par où commencer pour la fidélisation ?',
      clientCount: 0,
      expectIntent: 'knowledge',
      expectFires: ['CASE-NO-CONTACTS'],
      expectStrategies: ['STRAT-04'],
      answerMustMatch: [/first-party|collecte|contacts|fidélit/i],
      answerMustNotMatch: [/investissez d'abord en publicité payante massive/i],
    });
    expect(row.result).toBe('PASS');
  });

  it('S7 — contexte africain Brazzaville', async () => {
    const row = await runScenario({
      id: 'S7',
      question:
        'Restaurant à Brazzaville : nous utilisons WhatsApp, les espèces et le Mobile Money. Quelles recommandations adaptées ?',
      expectIntent: 'knowledge',
      answerMustMatch: [/WhatsApp|Mobile Money|Afrique|cash|espèces/i],
      answerMustNotMatch: [
        /vous disposez (déjà )?d['’]Uber Eats/i,
        /suppose que vous avez un TPE/i,
      ],
      checks: ({ answer }) => ({
        africaContextKept: /whatsapp|mobile money|afrique|brazzaville|espèces|cash/i.test(answer),
        doesNotAssumeEUPlatformsAsDefault: !/installez uber eats immédiatement/i.test(answer),
      }),
    });
    expect(row.result).toBe('PASS');
  });

  it('S8 — diagnostic financier sans chiffres', async () => {
    const row = await runScenario({
      id: 'S8',
      question:
        'Peux-tu me faire un diagnostic financier complet de mon restaurant ? Je n’ai pas mes coûts ni mon chiffre d’affaires sous la main.',
      clientCount: 5,
      expectIntent: 'knowledge',
      expectFires: ['CASE-INSUFFICIENT-FINANCE'],
      answerMustMatch: [/manquant|insuffisant|inventé|CA|Food Cost/i],
      answerMustNotMatch: [
        /votre food cost est de \d+/i,
        /votre marge nette est de \d+/i,
        /CA = \d{4,}/i,
      ],
      checks: ({ answer, missing }) => ({
        refusesInventedNumbers: /aucun chiffre inventé|insuffisant|manquant/i.test(answer),
        listsMissing: missing.length > 0,
        notFullDiagnosisClaim: !/diagnostic financier complet (est |a été )?établi/i.test(answer),
      }),
    });
    expect(row.result).toBe('PASS');
  });

  it('S9 — avis négatifs avant campagne fréquentation', async () => {
    const row = await runScenario({
      id: 'S9',
      question:
        'Nous recevons des avis négatifs et notre note moyenne diminue (3,2 / 5). Dois-je lancer une campagne pour augmenter la fréquentation ?',
      clientCount: 30,
      expectIntent: 'knowledge',
      expectFires: ['CASE-NEGATIVE-REVIEWS'],
      answerMustMatch: [/produit|opérations|avis|qualité|bloquer|priorit/i],
      answerMustNotMatch: [
        /lancez (immédiatement )?une campagne d['’]acquisition/i,
        /message a été envoyé/i,
      ],
      checks: ({ answer }) => ({
        prioritizesOps: /produit|ops|fiches techniques|qualité|bloquer/i.test(answer),
      }),
    });
    expect(row.result).toBe('PASS');
  });

  it('écrit le fichier de preuves P1', () => {
    const outDir = resolve(__dirname, '../../../../.tmp-bomaye-p1');
    mkdirSync(outDir, { recursive: true });
    const path = resolve(outDir, 'conversational-evidence.json');
    writeFileSync(
      path,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          mode: 'runMiChatTurn message-only (synthetic CRM)',
          scenarioCount: evidence.length,
          results: Object.fromEntries(
            evidence.map((e) => [e.id, e.result])
          ),
          scenarios: evidence,
        },
        null,
        2
      ),
      'utf8'
    );
    expect(evidence.length).toBeGreaterThanOrEqual(9);
  });
});

describe('P1 négatifs, isolation, variantes intent', () => {
  it('N1 — ne confond pas « WhatsApp » canal avec envoi', () => {
    expect(
      detectMiIntent(
        'À Brazzaville on utilise WhatsApp et le Mobile Money, quelles adaptations ?'
      )
    ).toBe('knowledge');
    expect(detectMiIntent('Envoie un WhatsApp à tous mes clients')).toBe('send_blocked');
  });

  it('N2 — variantes formulation intent knowledge', () => {
    expect(detectMiIntent('Notre food cost est à 35 %, aide-moi')).toBe('knowledge');
    expect(detectMiIntent('Trop dépendant d’Uber Eats, 40 % du CA')).toBe('knowledge');
    expect(detectMiIntent('On ouvre dans 5 mois, pré-ouverture')).toBe('knowledge');
    expect(
      detectMiIntent(
        'Notre taux de retour est faible. Les clients ne reviennent pas. Que faire ?'
      )
    ).toBe('knowledge');
    expect(
      detectMiIntent(
        'Avis négatifs et note moyenne diminue. Dois-je lancer une campagne pour la fréquentation ?'
      )
    ).toBe('knowledge');
    // Limite connue : formulation trop vague → pas knowledge
    expect(detectMiIntent('Comment améliorer mon resto ?')).toBe('general');
  });

  it('N3 — isolation org (snapshot ≠ session)', async () => {
    const result = await runMiChatTurn({
      supabase: {} as never,
      organizationId: 'org-session-p1',
      userId: 'u',
      message: 'Food cost dépasse 32 %.',
      loadInsights: async () => synthInsights('org-other-p1'),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/isolation/i);
    }
  });

  it('N4 — réponse refuse prétendre envoi WhatsApp', async () => {
    const turn = await runMiChatTurn({
      supabase: {} as never,
      organizationId: 'org-wa',
      userId: 'u',
      message:
        'Baisse de fréquentation de 15 %. Envisage réduction générale des prix de 20 %. Prépare un WhatsApp.',
      loadInsights: async () => synthInsights('org-wa'),
    });
    // SEND_RE peut primer si « Envoie » — ici « Prépare » + knowledge keywords
    if (turn.ok && turn.intent === 'knowledge') {
      expect(turn.answer).toMatch(/non envoyé|Aucun envoi|brouillon/i);
      expect(turn.answer).not.toMatch(/a été envoyé|message envoyé avec succès/i);
    } else {
      // Si send_blocked à cause d’un verbe — aussi acceptable tant que pas d’envoi
      expect(turn.ok ? turn.intent : 'err').toMatch(/knowledge|send_blocked/);
    }
  });

  it('N5 — seuil Bomaye non présenté comme loi universelle', async () => {
    const turn = await runMiChatTurn({
      supabase: {} as never,
      organizationId: 'org-seuil',
      userId: 'u',
      message: 'Notre Food Cost dépasse 32 %. Que faire ?',
      loadInsights: async () => synthInsights('org-seuil', { clientCount: 10 }),
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    expect(turn.answer).toMatch(/Bomaye|source/i);
    expect(turn.answer).toMatch(/pas une garantie universelle|seuil Bomaye|source Bomaye/i);
  });
});
