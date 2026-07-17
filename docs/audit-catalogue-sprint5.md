# Audit Catalogue — Sprint 5 (production readiness)

Date: 2026-07-17  
Commit cible: Sprint 5 (qualité, publication, traduction, aperçu, assistant)

## Synthèse

Le module Catalogue atteint un niveau **production-ready pour un premier déploiement à grande échelle**, avec des réserves listées ci-dessous. Les fondations (multi-tenant RLS, metadata JSONB extensible, pipeline IA unique, snapshots versionnés) sont saines.

| Domaine | Note | Commentaire |
|---------|------|-------------|
| UX/UI | 8/10 | Score, publication, aperçu QR, assistant — manque encore DnD & empty states riches |
| Performances | 7/10 | Limite `listCatalogItems` à 500 ; pas de virtual scroll |
| Sécurité | 8.5/10 | RLS sur settings/versions ; proxy worker allowlist ; pas de slug public exposé |
| Accessibilité | 6/10 | Dialogs custom sans focus trap / aria-modal complets |
| Responsive | 8/10 | Grille + aperçu sticky ; assistant fixed mobile-friendly |
| Qualité code | 8/10 | Domain pur testé ; merge metadata corrigé |
| Dette technique | 7/10 | Voir backlog |

## Ce qui est livré (Sprint 5)

1. **Score qualité /100** + breakdown + recommandations actionnables (`catalog-quality.ts`)
2. **KPIs** (produits, catégories, variantes, sans photo, incomplets, complétion)
3. **Publication** draft / in_review / published / archived + snapshots (`034`)
4. **Historique** versions + restauration best-effort
5. **Traduction IA** one-click (fr/en/es/pt/ar) via `catalog.translate`
6. **Aperçu menu QR** temps réel côte à côte
7. **Assistant latéral** (prompts + traduction + détection sans photo)
8. **Modèle snapshot** `schemaVersion: 1` prêt commandes / POS / fidélité / QR

## Optimisations restantes (avant scale)

### P0 — avant trafic élevé
- [x] Appliquer migration **034** en prod (confirmé 2026-07-17) et monitorer
- [ ] Virtual scrolling si > 500 / 2000 produits (`@tanstack/react-virtual`)
- [ ] Pagination / curseur serveur au-delà de la limite 500
- [ ] Focus trap + `Esc` + `aria-modal` sur DialogShell / assistant
- [ ] Rate-limit explicite sur `catalog/translate` et `catalog/variants` (coût tokens)

### P1 — expérience premium
- [ ] Drag & drop catégories / produits (Priorité 6 historique)
- [ ] Suggestions auto post-mutation (debounce) sans ouvrir l’assistant
- [ ] Prévisualisation locale de traduction avant replaceLive
- [ ] Page publique QR (`public_slug`) lecture seule depuis snapshot publié
- [ ] Disponibilité au niveau **produit** (pas seulement choix d’options)

### P2 — plateforme
- [ ] Tables dédiées `catalog_option_groups` si > 100k variantes (aujourd’hui JSONB OK)
- [ ] Événements domaine `catalog.published` / `catalog.translated` pour Inngest
- [ ] Tests e2e Playwright (import → variantes → publish → restore)
- [ ] Désactiver `AUTH_DEBUG` en prod ; brancher Resend + Upstash

### Sécurité / multi-tenant
- ✅ RLS `user_org_ids()` sur `catalog_*`
- ✅ Worker auth + allowlist paths
- ⚠ Ne pas exposer `public_slug` sans authz lecture publique dédiée
- ⚠ Restore ne recrée pas les items supprimés (documenté) — envisager upsert complet

### Accessibilité
- Boutons icône : vérifier labels `aria-label` partout
- Contraste score / badges amber sur dark theme
- Navigation clavier dans l’aperçu QR (scroll region)

## Verdict

**GO conditionnel** pour production à grande échelle une fois P0 traité (perf liste + a11y dialogs + rate-limit IA + migration 034 confirmée).  
Les features Sprint 5 couvrent le brief produit ; le backlog P1/P2 affine l’expérience « référence marché ».
