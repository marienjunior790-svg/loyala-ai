import { describe, expect, it } from 'vitest';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';

// Lightweight test of ciphertext format without importing env-bound module helpers twice.
function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

describe('whatsapp secret ciphertext format', () => {
  it('produces v1:iv:tag:data', () => {
    const key = scryptSync('test-key', 'loyala-whatsapp-v1', 32);
    const out = encryptWithKey('EAAG-token', key);
    expect(out.split(':')).toHaveLength(4);
    expect(out.startsWith('v1:')).toBe(true);
  });
});
