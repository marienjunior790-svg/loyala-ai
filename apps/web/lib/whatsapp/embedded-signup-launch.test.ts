import { describe, expect, it } from 'vitest';
import { buildEmbeddedSignupLoginOptions } from './embedded-signup-launch';

describe('buildEmbeddedSignupLoginOptions', () => {
  it('utilise Embedded Signup v4 (code) sans legacy sessionInfoVersion/solutionID', () => {
    const options = buildEmbeddedSignupLoginOptions('cfg-123');
    expect(options).toEqual({
      config_id: 'cfg-123',
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {} },
    });
    const serialized = JSON.stringify(options);
    expect(serialized).not.toMatch(/sessionInfoVersion|solutionID|version/i);
  });
});
