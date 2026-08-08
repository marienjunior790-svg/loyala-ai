import { describe, expect, it } from 'vitest';
import { parseAcquisitionSourceFromMessage, renderAcquisitionMessage } from './acquisition';

describe('parseAcquisitionSourceFromMessage', () => {
  it('reads ref tags', () => {
    expect(parseAcquisitionSourceFromMessage('Bonjour\n\n[ref:instagram]')).toBe('instagram');
    expect(parseAcquisitionSourceFromMessage('ref:qr_caisse')).toBe('qr_caisse');
    expect(parseAcquisitionSourceFromMessage('hello')).toBeNull();
  });
});

describe('renderAcquisitionMessage', () => {
  it('replaces restaurant placeholder', () => {
    expect(renderAcquisitionMessage('Salut {{restaurant}}', 'Chez Marie')).toBe('Salut Chez Marie');
  });
});
