import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const WA_ES_OAUTH_COOKIE = 'loyala_wa_es_oauth';
const MAX_AGE_MS = 10 * 60 * 1000;

export type WhatsAppEmbeddedSignupState = {
  organizationId: string;
  userId: string;
  nonce: string;
  exp: number;
};

function keyMaterial(): string {
  const key =
    process.env.LOYALA_SECRETS_ENCRYPTION_KEY?.trim() ||
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error('Chiffrement non configuré (LOYALA_SECRETS_ENCRYPTION_KEY).');
  return key;
}

function sign(payload: string): string {
  return createHmac('sha256', keyMaterial()).update(payload).digest('base64url');
}

export function createWhatsAppEmbeddedSignupState(input: {
  organizationId: string;
  userId: string;
}): { nonce: string; state: string } {
  const nonce = randomBytes(24).toString('base64url');
  const body: WhatsAppEmbeddedSignupState = {
    organizationId: input.organizationId,
    userId: input.userId,
    nonce,
    exp: Date.now() + MAX_AGE_MS,
  };
  const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
  return { nonce, state: `${payload}.${sign(payload)}` };
}

export function readWhatsAppEmbeddedSignupState(
  state: string,
  nonce: string,
  now = Date.now()
): WhatsAppEmbeddedSignupState {
  const [payload, mac] = state.split('.');
  if (!payload || !mac) throw new Error('État de connexion invalide');
  const expected = sign(payload);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error('État de connexion invalide');
  }
  let body: WhatsAppEmbeddedSignupState;
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as WhatsAppEmbeddedSignupState;
  } catch {
    throw new Error('État de connexion invalide');
  }
  if (!body.organizationId || !body.userId || !body.nonce || body.nonce !== nonce || body.exp < now) {
    throw new Error('État de connexion invalide');
  }
  return body;
}
