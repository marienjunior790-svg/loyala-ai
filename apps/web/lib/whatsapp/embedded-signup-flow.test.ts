import { describe, expect, it } from 'vitest';
import {
  canClaimConnected,
  embeddedSignupFlowCopy,
  finalizeEmbeddedSignupClientResult,
  mapLaunchFailureToPhase,
  resolveInitialEmbeddedSignupPhase,
} from './embedded-signup-flow';

describe('embedded-signup-flow', () => {
  it('démarre unconfigured / ready / already_connected selon le contexte', () => {
    expect(resolveInitialEmbeddedSignupPhase({ canLaunch: false, connectionReady: false })).toBe(
      'unconfigured'
    );
    expect(resolveInitialEmbeddedSignupPhase({ canLaunch: true, connectionReady: false })).toBe('ready');
    expect(resolveInitialEmbeddedSignupPhase({ canLaunch: true, connectionReady: true })).toBe(
      'already_connected'
    );
  });

  it('distingue annulation et échec', () => {
    expect(mapLaunchFailureToPhase('cancelled')).toBe('cancelled');
    expect(mapLaunchFailureToPhase('missing_code')).toBe('failed');
    expect(embeddedSignupFlowCopy('cancelled').detail).toMatch(/réessayer/i);
    expect(embeddedSignupFlowCopy('failed').tone).toBe('danger');
  });

  it('refuse un faux succès sans health', () => {
    expect(canClaimConnected({ serverConnected: true, healthOk: false })).toBe(false);
    expect(canClaimConnected({ serverConnected: false, healthOk: true })).toBe(false);
    expect(canClaimConnected({ serverConnected: true, healthOk: true })).toBe(true);
    expect(
      finalizeEmbeddedSignupClientResult({
        isReady: true,
        healthOk: false,
        healthMessage: 'timeout',
      }).connected
    ).toBe(false);
    expect(
      finalizeEmbeddedSignupClientResult({
        isReady: true,
        healthOk: true,
        healthMessage: 'ok',
      }).success
    ).toMatch(/connecté/i);
  });

  it('n’expose aucun jargon technique dans les copies utilisateur', () => {
    const phases = [
      'ready',
      'launching_meta',
      'meta_authenticating',
      'server_processing',
      'verifying',
      'connected',
      'cancelled',
      'failed',
    ] as const;
    for (const phase of phases) {
      const copy = embeddedSignupFlowCopy(phase);
      const blob = `${copy.title} ${copy.detail}`.toLowerCase();
      expect(blob).not.toMatch(/waba|phone number id|access token|graph api|app secret|eaa/);
    }
  });
});
