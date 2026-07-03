# Quality Engineering

## SLO

| Indicateur | J2 | J3 |
|------------|-----|-----|
| Coverage unitaire (packages/) | ≥ 70% | ≥ 80% |
| Taux régression / release | < 10% | < 5% |
| Disponibilité | ≥ 99.5% | ≥ 99.9% |
| P95 API read | < 500ms | < 300ms |
| Error rate API | < 0.5% | < 0.1% |
| MTTR P0 | < 4h | < 2h |
| Change failure rate | < 15% | < 10% |

## E2E P0 (Sprint 0 → J1)

1. Signup → onboarding → créer client
2. Campagne → envoi (mock WA)
3. Login → switch org → isolation
4. Inbox → brouillon IA
5. Staff ne peut pas send campaign

## CI gates (merge bloqué si échec)

- `tsc --noEmit`
- ESLint
- Vitest unit
- RLS cross-tenant suite
- Secret scan
- Bundle < 200KB

## Dette technique

- Ratio dette / sprint ≤ 15%
- 0 TODO sans ticket en `main`
- 0 logique métier sans tests dans `core-*`
