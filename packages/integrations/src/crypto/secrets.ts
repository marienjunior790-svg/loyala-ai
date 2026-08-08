import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const PREFIX = 'v1';

function getKeyMaterial(): Buffer {
  const raw =
    process.env.LOYALA_SECRETS_ENCRYPTION_KEY?.trim() ||
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      'LOYALA_SECRETS_ENCRYPTION_KEY (ou WHATSAPP_TOKEN_ENCRYPTION_KEY) requis pour stocker les tokens WhatsApp'
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === 32) return b64;
  } catch {
    /* fall through */
  }
  return scryptSync(raw, 'loyala-whatsapp-v1', 32);
}

export function isSecretEncryptionConfigured(): boolean {
  return Boolean(
    process.env.LOYALA_SECRETS_ENCRYPTION_KEY?.trim() ||
      process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY?.trim()
  );
}

/** AES-256-GCM — ciphertext format: v1:iv:tag:data (base64 parts). */
export function encryptSecret(plaintext: string): string {
  const key = getKeyMaterial();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('Format de secret chiffré invalide');
  }
  const key = getKeyMaterial();
  const iv = Buffer.from(parts[1]!, 'base64');
  const tag = Buffer.from(parts[2]!, 'base64');
  const data = Buffer.from(parts[3]!, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
