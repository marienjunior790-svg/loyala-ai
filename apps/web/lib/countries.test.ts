import { describe, expect, it } from 'vitest';
import { CENTRAL_AFRICA_COUNTRIES, COUNTRY_OPTIONS, getCountryOption } from './countries';

describe('countries', () => {
  it('lists all Central African countries', () => {
    const codes = CENTRAL_AFRICA_COUNTRIES.map((c) => c.code).sort();
    expect(codes).toEqual(['AO', 'CD', 'CF', 'CG', 'CM', 'GA', 'GQ', 'ST', 'TD']);
  });

  it('maps Congo to XAF / Brazzaville', () => {
    const cg = getCountryOption('CG');
    expect(cg?.currency).toBe('XAF');
    expect(cg?.timezone).toBe('Africa/Brazzaville');
  });

  it('keeps Afrique centrale first in select list', () => {
    expect(COUNTRY_OPTIONS[0]?.region).toBe('central');
  });
});
