import type { SendMessageInput, SendMessageResult } from '../types';

/** Placeholder — Twilio provider reserved for regional fallback. */
export async function sendViaTwilio(_input: SendMessageInput): Promise<SendMessageResult> {
  throw new Error('Twilio messaging provider is not implemented — use provider "meta"');
}
