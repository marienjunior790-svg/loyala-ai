import { describe, expect, it } from 'vitest';
import { enrichCatalogGenerateBrief } from './automation-service';

describe('enrichCatalogGenerateBrief', () => {
  it('appends full-menu instructions for name/address-only briefs', () => {
    const brief =
      'Le Fleuve Congo — 12 Avenue de la Paix, Kinshasa · Ouvert tous les jours de 12h à 23h';
    const enriched = enrichCatalogGenerateBrief(brief);
    expect(enriched).toContain('Le Fleuve Congo');
    expect(enriched).toContain('catalogue COMPLET');
    expect(enriched).toMatch(/Kinshasa/i);
  });

  it('keeps explicit menu briefs unchanged', () => {
    const brief = 'Menu complet pour un restaurant de burgers et grillades avec desserts et boissons';
    expect(enrichCatalogGenerateBrief(brief)).toBe(brief);
  });

  it('provides a default brief when empty', () => {
    expect(enrichCatalogGenerateBrief('')).toMatch(/catalogue restaurant complet/i);
  });
});
