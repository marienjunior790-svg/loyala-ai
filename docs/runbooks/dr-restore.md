# DR Restore Runbook (Skeleton)

## Objectifs
- RPO: 1h (J2)
- RTO: 4h (J2)

## Procédure restauration PostgreSQL

1. Identifier point de restauration (PITR timestamp)
2. Supabase Dashboard → Database → Backups → Restore
3. Vérifier migrations appliquées : `supabase db diff`
4. Smoke tests :
   - Login
   - Cross-tenant isolation
   - API health `/api/health`
5. Communiquer sur status.loyala.ai

## Test trimestriel
- [ ] Restauration sandbox documentée
- [ ] Durée mesurée < RTO
- [ ] Post-mortem si échec

## Contacts
- On-call Engineering: [à définir]
- Supabase support: dashboard
