import { orchestrate, clearAICache } from '../orchestrator/orchestrate';
import { segmentSchema } from '../schemas/outputs';
import { computeRFMScore, type ClientRFMInput, type RFMScore } from '../rfm/scoring';
import type { SegmentResult } from '../schemas/outputs';

export interface SegmentationResult {
  clientId: string;
  rfm: RFMScore;
  ai: SegmentResult;
}

/** Hybrid segmentation: deterministic RFM + AI enrichment (minimal tokens) */
export async function segmentClient(
  organizationId: string,
  client: ClientRFMInput & { fullName: string }
): Promise<SegmentationResult> {
  const rfm = computeRFMScore(client);

  const response = await orchestrate({
    organizationId,
    useCase: 'client.segment',
    input: {
      clientId: client.clientId,
      fullName: client.fullName,
      rfmSegment: rfm.segment,
      recencyScore: rfm.recencyScore,
      frequencyScore: rfm.frequencyScore,
      monetaryScore: rfm.monetaryScore,
    },
    jsonSchema: segmentSchema,
  });

  return {
    clientId: client.clientId,
    rfm,
    ai: response.parsed as SegmentResult,
  };
}

export async function segmentClientsBatch(
  organizationId: string,
  clients: (ClientRFMInput & { fullName: string })[]
): Promise<SegmentationResult[]> {
  return Promise.all(clients.map((c) => segmentClient(organizationId, c)));
}
