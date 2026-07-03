import { orchestrate } from '../orchestrator/orchestrate';
import { autoReplySchema } from '../schemas/outputs';
import type { AutoReply } from '../schemas/outputs';

export interface AutoReplyInput {
  message: string;
  clientName?: string;
  restaurantName?: string;
  context?: string;
}

export async function generateAutoReply(
  organizationId: string,
  input: AutoReplyInput
): Promise<AutoReply & { needsHumanReview: boolean }> {
  const response = await orchestrate({
    organizationId,
    useCase: 'inbox.reply.generate',
    input: {
      message: input.message,
      context: JSON.stringify({
        clientName: input.clientName,
        restaurantName: input.restaurantName,
        extra: input.context,
      }),
    },
    jsonSchema: autoReplySchema,
  });

  const parsed = response.parsed as AutoReply;
  return {
    ...parsed,
    needsHumanReview: parsed.needsHumanReview ?? true,
  };
}
