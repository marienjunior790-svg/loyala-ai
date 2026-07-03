import {
  computeRFMScore,
  computeRFMBatch,
  type ClientRFMInput,
  type RFMScore,
} from './scoring';
import { processBatch } from '../batch/processBatch';
import { segmentClient, type SegmentationResult } from '../engines/segmentation';

export interface RFMEngineOptions {
  /** Only run LLM enrichment for at-risk / dormant / vip segments */
  aiEnrichSegments?: RFMScore['segment'][];
}

const DEFAULT_AI_SEGMENTS: RFMScore['segment'][] = ['vip', 'at_risk', 'dormant'];

/**
 * RFM Scoring Engine — deterministic scoring before optional LLM enrichment.
 * Minimizes API costs: LLM only on high-value segments.
 */
export class RFMEngine {
  constructor(
    private readonly tenantId: string,
    private readonly options: RFMEngineOptions = {}
  ) {}

  score(client: ClientRFMInput): RFMScore {
    return computeRFMScore(client);
  }

  scoreBatch(clients: ClientRFMInput[]): RFMScore[] {
    return computeRFMBatch(clients);
  }

  async enrichWithAI(
    clients: (ClientRFMInput & { fullName: string })[]
  ): Promise<SegmentationResult[]> {
    const segments = this.options.aiEnrichSegments ?? DEFAULT_AI_SEGMENTS;

    return processBatch(clients, async (client) => {
      const rfm = computeRFMScore(client);
      if (!segments.includes(rfm.segment)) {
        return {
          clientId: client.clientId,
          rfm,
          ai: {
            segment: mapRfmToAiSegment(rfm.segment),
            confidence: 1,
            action: 'Aucune action requise',
            reason: `Segment RFM ${rfm.segment} — pas d'enrichissement IA`,
          },
        };
      }
      return segmentClient(this.tenantId, client);
    });
  }
}

function mapRfmToAiSegment(
  segment: RFMScore['segment']
): 'vip' | 'regular' | 'at_risk' | 'new' | 'dormant' {
  if (segment === 'vip' || segment === 'loyal') return 'vip';
  if (segment === 'at_risk') return 'at_risk';
  if (segment === 'dormant') return 'dormant';
  if (segment === 'new') return 'new';
  return 'regular';
}

export function createRFMEngine(
  tenantId: string,
  options?: RFMEngineOptions
): RFMEngine {
  return new RFMEngine(tenantId, options);
}

export { computeRFMScore, computeRFMBatch };
export type { ClientRFMInput, RFMScore };
