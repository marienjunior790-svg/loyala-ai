# Disaster Recovery

## Objectifs

| Métrique | J2 | J3 Enterprise |
|----------|-----|---------------|
| RPO | 1 heure | 15 min |
| RTO | 4 heures | 1 heure |
| RTO API read | 2 heures | 30 min |

## Sauvegardes

| Composant | Méthode | Rétention |
|-----------|---------|-----------|
| PostgreSQL | Supabase PITR + daily | 30j PITR, 90j snapshots |
| Storage | Replication | 90 jours |
| domain_events | Export S3 daily | 36 mois |
| Secrets | Vercel + Vault versionné | 12 mois |

**Test restauration :** trimestriel (J2), mensuel (J3).

## Multi-région

- J1–J2 : EU (Frankfurt) + CDN global
- J3 : read replica analytics, évaluer Afrique du Sud
- Enterprise : tenant dédié optionnel

## Fallbacks fournisseurs

| Fournisseur | Fallback |
|-------------|----------|
| WhatsApp | Queue 24h + SMS |
| OpenAI | Modèle secondaire + templates |
| Stripe | Grace 72h |
| Google Reviews | Retry 6h, mode dégradé |

## Sévérité incidents

| Niveau | RTO cible |
|--------|-----------|
| P0 (fuite cross-tenant) | < 1h containment |
| P1 (app down) | < 4h |
| P2 (feature dégradée) | < 24h |
