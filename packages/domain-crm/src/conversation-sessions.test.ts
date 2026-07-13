import { describe, expect, it } from 'vitest';
import {
  isSessionOpen,
  normalizeAddressForChannel,
  WHATSAPP_SESSION_WINDOW_MS,
} from './conversation-sessions';

describe('isSessionOpen', () => {
  const now = Date.parse('2026-07-13T12:00:00.000Z');

  it('returns false when no inbound timestamp', () => {
    expect(isSessionOpen(null, now)).toBe(false);
    expect(isSessionOpen(undefined, now)).toBe(false);
  });

  it('returns true within 24h window', () => {
    const recent = new Date(now - WHATSAPP_SESSION_WINDOW_MS + 60_000).toISOString();
    expect(isSessionOpen(recent, now)).toBe(true);
  });

  it('returns false after 24h window', () => {
    const old = new Date(now - WHATSAPP_SESSION_WINDOW_MS - 1).toISOString();
    expect(isSessionOpen(old, now)).toBe(false);
  });
});

describe('normalizeAddressForChannel', () => {
  it('normalizes local Congo numbers for whatsapp', () => {
    expect(normalizeAddressForChannel('whatsapp', '065719922')).toBe('24265719922');
  });

  it('keeps international digits', () => {
    expect(normalizeAddressForChannel('whatsapp', '221771234567')).toBe('221771234567');
  });
});
