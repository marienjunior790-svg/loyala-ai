import { describe, expect, it } from 'vitest';
import { isNavActive, mainNav } from './navigation';

describe('navigation Marketing Intelligence', () => {
  it('expose l’entrée Marketing IA vers /marketing-intelligence', () => {
    const item = mainNav.find((n) => n.href === '/marketing-intelligence');
    expect(item).toBeDefined();
    expect(item?.label).toMatch(/Marketing/i);
    expect(item?.mobile).toBe(false);
  });

  it('isNavActive pour sous-routes MI', () => {
    expect(isNavActive('/marketing-intelligence', '/marketing-intelligence')).toBe(true);
    expect(isNavActive('/marketing-intelligence/foo', '/marketing-intelligence')).toBe(true);
    expect(isNavActive('/analytics', '/marketing-intelligence')).toBe(false);
  });

  it('ne retire pas les entrées CRM existantes', () => {
    const hrefs = mainNav.map((n) => n.href);
    expect(hrefs).toContain('/clients');
    expect(hrefs).toContain('/segments');
    expect(hrefs).toContain('/campaigns');
    expect(hrefs).toContain('/analytics');
  });
});
