import { describe, expect, it } from 'vitest';
import {
  describeEmbeddedSignupCapability,
  readEmbeddedSignupPublicConfig,
  resolveMetaAppSecret,
} from './embedded-signup-config';

const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('embedded-signup-config', () => {
  it('ne renvoie jamais de secret dans la capacité publique', () => {
    const capability = describeEmbeddedSignupCapability({
      NEXT_PUBLIC_META_APP_ID: '111',
      NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: '222',
      WHATSAPP_APP_SECRET: 'super-secret-app',
      LOYALA_SECRETS_ENCRYPTION_KEY: encryptionKey,
    });
    const serialized = JSON.stringify(capability);
    expect(serialized).not.toContain('super-secret-app');
    expect(serialized).not.toContain(encryptionKey);
    expect(capability.canLaunch).toBe(true);
  });

  it('préfère WHATSAPP_APP_SECRET à META_APP_SECRET', () => {
    expect(
      resolveMetaAppSecret({
        WHATSAPP_APP_SECRET: 'canonical',
        META_APP_SECRET: 'alias',
      })
    ).toBe('canonical');
  });

  it('lit les IDs publics sans secret', () => {
    expect(
      readEmbeddedSignupPublicConfig({
        NEXT_PUBLIC_META_APP_ID: ' 111 ',
        NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: ' 222 ',
      })
    ).toEqual({ appId: '111', configId: '222', apiVersion: 'v21.0' });
  });
});
