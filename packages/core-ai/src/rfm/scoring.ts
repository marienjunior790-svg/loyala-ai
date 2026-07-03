export interface ClientRFMInput {
  clientId: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
}

export interface RFMScore {
  clientId: string;
  recencyScore: 1 | 2 | 3 | 4 | 5;
  frequencyScore: 1 | 2 | 3 | 4 | 5;
  monetaryScore: 1 | 2 | 3 | 4 | 5;
  totalScore: number;
  segment: 'vip' | 'loyal' | 'regular' | 'at_risk' | 'dormant' | 'new';
}

function scoreRecency(days: number): 1 | 2 | 3 | 4 | 5 {
  if (days <= 7) return 5;
  if (days <= 14) return 4;
  if (days <= 30) return 3;
  if (days <= 60) return 2;
  return 1;
}

function scoreFrequency(freq: number): 1 | 2 | 3 | 4 | 5 {
  if (freq >= 20) return 5;
  if (freq >= 10) return 4;
  if (freq >= 5) return 3;
  if (freq >= 2) return 2;
  return 1;
}

function scoreMonetary(amount: number): 1 | 2 | 3 | 4 | 5 {
  if (amount >= 500_000) return 5;
  if (amount >= 200_000) return 4;
  if (amount >= 100_000) return 3;
  if (amount >= 50_000) return 2;
  return 1;
}

function deriveSegment(
  r: number,
  f: number,
  m: number,
  recencyDays: number,
  frequency: number
): RFMScore['segment'] {
  if (frequency === 0) return 'new';
  if (r <= 2 && f >= 3) return 'at_risk';
  if (r <= 2 && f <= 2) return 'dormant';
  if (r >= 4 && f >= 4 && m >= 4) return 'vip';
  if (r >= 3 && f >= 3) return 'loyal';
  return 'regular';
}

export function computeRFMScore(client: ClientRFMInput): RFMScore {
  const recencyScore = scoreRecency(client.recencyDays);
  const frequencyScore = scoreFrequency(client.frequency);
  const monetaryScore = scoreMonetary(client.monetary);
  const totalScore = recencyScore + frequencyScore + monetaryScore;

  return {
    clientId: client.clientId,
    recencyScore,
    frequencyScore,
    monetaryScore,
    totalScore,
    segment: deriveSegment(
      recencyScore,
      frequencyScore,
      monetaryScore,
      client.recencyDays,
      client.frequency
    ),
  };
}

export function computeRFMBatch(clients: ClientRFMInput[]): RFMScore[] {
  return clients.map(computeRFMScore);
}
