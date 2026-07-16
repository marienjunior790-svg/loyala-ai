# OpenPay Congo — Intégration Loyala AI

## Architecture

```
Dashboard /billing → Server Action → @loyala/domain-billing
                                 → OpenPayCgClient (XO-API-KEY)
OpenPay API ← → Worker POST /billing/webhook (stub verify)
Inngest poll  → getPaymentStatus (OPENPAY_STATUS_PATH) → apply_openpay_payment_succeeded
```

Provider unique : `BILLING_PROVIDER=openpay_cg`.

## Install / config

### Variables

| Variable | Où | Notes |
|----------|-----|--------|
| `OPENPAY_API_KEY` | Worker + Web (server) | Jamais client |
| `OPENPAY_API_BASE` | défaut `https://api.openpay-cg.com/v1` | |
| `OPENPAY_WEBHOOK_SECRET` | Worker | Optionnel jusqu’à spec signature |
| `OPENPAY_STATUS_PATH` | Worker | Optionnel — path privé status |
| `BILLING_ENABLED` | `true` pour activer checkout | |
| `BILLING_PROVIDER` | `openpay_cg` | |

### Migrations

```bash
node scripts/apply-028-unify-plans.mjs   # ou apply-migration pooler runner
node scripts/apply-029-openpay-billing.mjs
```

Fichiers : `028_unify_billing_plans.sql`, `029_openpay_billing.sql`.

### Railway worker

- Expose `https://<worker>/billing/webhook`
- Expose `GET /billing/health`
- Set OpenPay env vars

### Vercel web

- `BILLING_ENABLED`, `OPENPAY_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (écritures payments)

## Flux checkout

1. Owner/admin ouvre `/billing/checkout?plan=growth|pro`
2. Saisie téléphone +242 + MTN/Airtel
3. `POST api.openpay-cg.com/v1/transaction/payment`
4. Ligne `payments` status `pending`
5. Activation abonnement via webhook (si payload connu) **ou** poll Inngest

## Limites doc publique (gate)

Voir `docs/decisions/2026-07-16-openpay-congo-docs-gate.md`.

Webhooks/refunds/status **non documentés** sur openpay.cg → stubs typés. Coller les specs privées ici avant claim production-complete.

## Troubleshooting

| Symptoôme | Action |
|-----------|--------|
| `BILLING_ENABLED` error | Set `true` on Vercel |
| OpenPay HTTP error | Check key + phone format 242… |
| Plan not updating | Apply 029; RPC `apply_openpay_payment_succeeded` |
| Double pending | TTL 15 min anti-double dans `startCheckout` |

## Purge Stripe

`STRIPE_SECRET_KEY` retiré de `packages/validation`. Ne pas réintroduire.
