# Ce qui ne doit jamais être cassé

## Techniques (inviolables)

| ID | Principe |
|----|----------|
| T1 | Isolation tenant absolue — tests cross-tenant CI chaque PR |
| T2 | Zéro perte de données en migration — backup ou rollback |
| T3 | API publique rétrocompatible — sunset min 12 mois |
| T4 | Auth server-authoritative — jamais org_id client seul |
| T5 | Secrets jamais exposés au browser |
| T6 | IA uniquement via orchestrator |
| T7 | Events versionnés — pas de breaking payload sans version |

## Produit & plans

| ID | Principe |
|----|----------|
| P1 | Feature compatible 3 plans OU restrictions documentées |
| P2 | Données client = propriété du restaurant |
| P3 | Opt-in WhatsApp/SMS obligatoire |
| P4 | IA augmentée — auto-send = opt-in explicite |
| P5 | Mobile-first — testé mobile avant ship |

## Performance

| ID | Seuil J2 | Seuil J3 |
|----|----------|----------|
| E1 P95 API read | < 500ms | < 300ms |
| E2 TTI mobile 4G | < 3s | < 3s |
| E3 Bundle JS initial | < 200KB gzip | < 200KB |
| E4 Uptime | ≥ 99.5% | ≥ 99.9% |

## Dérogation

Violation → ADR + approbation CEO + plan correction max 90 jours.

## Checklist feature (Annexe)

- [ ] Module cœur/métier identifié
- [ ] RBAC + ABAC définis
- [ ] Events documentés
- [ ] API publique mise à jour si applicable
- [ ] Compatible multi-produit
- [ ] IA via orchestrator
- [ ] Tests cross-tenant
- [ ] Impact métriques SaaS
- [ ] Gate économique passé
- [ ] Mobile/offline considéré
