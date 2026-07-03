import { orchestrate } from '../orchestrator/orchestrate';
import { messageClassifySchema } from '../schemas/outputs';
import type { MessageClassification } from '../schemas/outputs';
import { toPromptRecord, type ClassifyVariables } from '../types/prompt-variables';
import { processBatch } from '../batch/processBatch';

export interface ClassificationInput {
  messageId: string;
  text: string;
  channel?: string;
}

export interface ClassificationResult extends MessageClassification {
  messageId: string;
  /** Deterministic priority score 0–100 for inbox routing */
  priorityScore: number;
  channel?: string;
}

const INTENT_WEIGHT: Record<MessageClassification['intent'], number> = {
  complaint: 40,
  reservation: 25,
  loyalty: 20,
  question: 15,
  spam: 5,
  other: 10,
};

const SENTIMENT_WEIGHT: Record<MessageClassification['sentiment'], number> = {
  negative: 35,
  neutral: 15,
  positive: 5,
};

const PRIORITY_WEIGHT: Record<MessageClassification['priority'], number> = {
  high: 25,
  medium: 15,
  low: 5,
};

/** Deterministic priority scoring — complements LLM classification */
export function computePriorityScore(classification: MessageClassification): number {
  const raw =
    INTENT_WEIGHT[classification.intent] +
    SENTIMENT_WEIGHT[classification.sentiment] +
    PRIORITY_WEIGHT[classification.priority];

  return Math.min(100, Math.max(0, raw));
}

export class ClassificationPipeline {
  constructor(private readonly tenantId: string) {}

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const variables: ClassifyVariables = {
      message: input.text,
      messageId: input.messageId,
    };

    const response = await orchestrate({
      tenantId: this.tenantId,
      promptKey: 'inbox.message.classify',
      variables: toPromptRecord(variables),
      jsonSchema: messageClassifySchema,
    });

    const parsed = response.parsed as MessageClassification;
    return {
      ...parsed,
      messageId: input.messageId,
      priorityScore: computePriorityScore(parsed),
      channel: input.channel,
    };
  }

  async classifyBatch(
    messages: ClassificationInput[],
    concurrency = 5
  ): Promise<ClassificationResult[]> {
    return processBatch(messages, (m) => this.classify(m), { concurrency });
  }
}

export function createClassificationPipeline(tenantId: string): ClassificationPipeline {
  return new ClassificationPipeline(tenantId);
}

/** @deprecated use ClassificationPipeline */
export async function classifyMessage(
  organizationId: string,
  input: ClassificationInput
): Promise<ClassificationResult> {
  return createClassificationPipeline(organizationId).classify(input);
}

export async function classifyMessagesBatch(
  organizationId: string,
  messages: ClassificationInput[],
  concurrency = 5
): Promise<ClassificationResult[]> {
  return createClassificationPipeline(organizationId).classifyBatch(messages, concurrency);
}
