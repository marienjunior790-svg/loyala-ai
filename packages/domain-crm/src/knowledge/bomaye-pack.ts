/**
 * Façade pack Bomaye V2 — accès unique pour MI / tests.
 */
import { BOMAYE_MARKET_ADAPTATIONS, getBomayeAdaptationsForContext } from './bomaye-adaptations';
import {
  BOMAYE_DECISION_RULES,
  BOMAYE_FREQUENT_ERRORS,
  BOMAYE_PILLARS,
  getBomayeDecisionRule,
  listBomayeDecisionRules,
} from './bomaye-decision-rules';
import { BOMAYE_KPI_FORMULAS, computeBomayeRatioPct, listBomayeKpiFormulas } from './bomaye-kpis';
import { BOMAYE_KNOWLEDGE_SOURCE } from './bomaye-source';
import {
  BOMAYE_STRATEGIES,
  getBomayeStrategy,
  listBomayeStrategies,
  type BomayeStrategyId,
} from './bomaye-strategies';
import {
  evaluateBomayeAdvisor,
  formatBomayeAdvisorAnswer,
  selectBomayeKnowledgeSlice,
  type BomayeAdvisorSignals,
} from './bomaye-advisor';
import {
  deriveBomayeSignalsFromCrm,
  mergeBomayeSignalSources,
} from './bomaye-crm-bridge';

export const BOMAYE_PACK = {
  source: BOMAYE_KNOWLEDGE_SOURCE,
  strategies: BOMAYE_STRATEGIES,
  decisionRules: BOMAYE_DECISION_RULES,
  kpiFormulas: BOMAYE_KPI_FORMULAS,
  adaptations: BOMAYE_MARKET_ADAPTATIONS,
  pillars: BOMAYE_PILLARS,
  frequentErrors: BOMAYE_FREQUENT_ERRORS,
} as const;

export function getBomayePackSummary(): {
  documentId: string;
  version: string;
  strategyCount: number;
  decisionRuleCount: number;
  kpiCount: number;
  strategyIds: BomayeStrategyId[];
} {
  return {
    documentId: BOMAYE_KNOWLEDGE_SOURCE.documentId,
    version: BOMAYE_KNOWLEDGE_SOURCE.version,
    strategyCount: BOMAYE_STRATEGIES.length,
    decisionRuleCount: BOMAYE_DECISION_RULES.length,
    kpiCount: BOMAYE_KPI_FORMULAS.length,
    strategyIds: BOMAYE_STRATEGIES.map((s) => s.id),
  };
}

/** Recherche naïve par mots-clés sur stratégies / règles (pas de RAG). */
export function searchBomayeKnowledge(query: string): {
  strategies: BomayeStrategyId[];
  ruleIds: string[];
} {
  const q = query.toLowerCase();
  const strategies = BOMAYE_STRATEGIES.filter((s) => {
    const blob = [
      s.id,
      s.name,
      s.category,
      s.commercialProblem,
      s.objective,
      s.principle,
      ...s.kpis,
      ...s.risks,
    ]
      .join(' ')
      .toLowerCase();
    return q.split(/\s+/).filter((w) => w.length > 3).some((w) => blob.includes(w));
  }).map((s) => s.id);

  const ruleIds = BOMAYE_DECISION_RULES.filter((r) => {
    const blob = `${r.id} ${r.name} ${r.narrative.if} ${r.narrative.then}`.toLowerCase();
    return q.split(/\s+/).filter((w) => w.length > 3).some((w) => blob.includes(w));
  }).map((r) => r.id);

  return { strategies, ruleIds };
}

export {
  BOMAYE_KNOWLEDGE_SOURCE,
  BOMAYE_STRATEGIES,
  BOMAYE_DECISION_RULES,
  BOMAYE_KPI_FORMULAS,
  BOMAYE_MARKET_ADAPTATIONS,
  BOMAYE_PILLARS,
  BOMAYE_FREQUENT_ERRORS,
  getBomayeStrategy,
  listBomayeStrategies,
  getBomayeDecisionRule,
  listBomayeDecisionRules,
  listBomayeKpiFormulas,
  computeBomayeRatioPct,
  getBomayeAdaptationsForContext,
  evaluateBomayeAdvisor,
  formatBomayeAdvisorAnswer,
  selectBomayeKnowledgeSlice,
  deriveBomayeSignalsFromCrm,
  mergeBomayeSignalSources,
};

export type { BomayeStrategyId, BomayeAdvisorSignals };
