import { describe, expect, it } from 'vitest';
import { isAvailableNow, describeAvailability } from './availability';

describe('availability', () => {
  it('treats undefined/available as always on', () => {
    expect(isAvailableNow(undefined)).toBe(true);
    expect(isAvailableNow({ status: 'available' })).toBe(true);
  });

  it('treats unavailable as always off', () => {
    expect(isAvailableNow({ status: 'unavailable' })).toBe(false);
  });

  it('restricts scheduled by weekday', () => {
    // Monday 2024-01-01 12:00
    const monday = new Date('2024-01-01T12:00:00');
    expect(isAvailableNow({ status: 'scheduled', days: [1] }, monday)).toBe(true);
    expect(isAvailableNow({ status: 'scheduled', days: [0, 6] }, monday)).toBe(false);
  });

  it('restricts scheduled by time window', () => {
    const noon = new Date('2024-01-01T12:00:00');
    expect(isAvailableNow({ status: 'scheduled', timeStart: '11:00', timeEnd: '14:00' }, noon)).toBe(true);
    expect(isAvailableNow({ status: 'scheduled', timeStart: '18:00', timeEnd: '22:00' }, noon)).toBe(false);
  });

  it('supports overnight windows', () => {
    const oneAm = new Date('2024-01-01T01:00:00');
    expect(isAvailableNow({ status: 'scheduled', timeStart: '22:00', timeEnd: '02:00' }, oneAm)).toBe(true);
    const noon = new Date('2024-01-01T12:00:00');
    expect(isAvailableNow({ status: 'scheduled', timeStart: '22:00', timeEnd: '02:00' }, noon)).toBe(false);
  });

  it('describes availability for admin UI', () => {
    expect(describeAvailability(undefined)).toBe('Disponible');
    expect(describeAvailability({ status: 'unavailable' })).toBe('Indisponible');
    expect(describeAvailability({ status: 'scheduled', timeStart: '11:00', timeEnd: '14:00' })).toMatch(/11:00/);
  });
});
