import { orchestrate } from '../orchestrator/orchestrate';
import { inactiveAnalysisSchema } from '../schemas/outputs';
import type { InactiveAnalysis } from '../schemas/outputs';

export interface InactiveClient {
  clientId: string;
  fullName: string;
  phone: string;
  lastVisitAt: string | null;
  visitCount: number;
  totalSpent: number;
}

export interface InactiveDetectionConfig {
  inactiveDaysThreshold: number;
}

const DEFAULT_CONFIG: InactiveDetectionConfig = {
  inactiveDaysThreshold: 14,
};

export function detectInactiveClients(
  clients: InactiveClient[],
  config: InactiveDetectionConfig = DEFAULT_CONFIG
): (InactiveClient & { daysInactive: number })[] {
  const now = Date.now();

  return clients
    .map((client) => {
      if (!client.lastVisitAt) {
        return { ...client, daysInactive: Infinity };
      }
      const days = Math.floor(
        (now - new Date(client.lastVisitAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      return { ...client, daysInactive: days };
    })
    .filter((c) => c.daysInactive >= config.inactiveDaysThreshold)
    .sort((a, b) => b.daysInactive - a.daysInactive);
}

export async function analyzeInactiveClient(
  organizationId: string,
  client: InactiveClient & { daysInactive: number }
): Promise<InactiveAnalysis> {
  const response = await orchestrate({
    organizationId,
    useCase: 'client.inactive.analyze',
    input: {
      daysInactive: String(client.daysInactive),
      payload: JSON.stringify({
        clientId: client.clientId,
        fullName: client.fullName,
        visitCount: client.visitCount,
        totalSpent: client.totalSpent,
      }),
    },
    jsonSchema: inactiveAnalysisSchema,
  });

  return response.parsed as InactiveAnalysis;
}
