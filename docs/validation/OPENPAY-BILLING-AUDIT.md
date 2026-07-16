# Audit — OpenPay Congo billing (2026-07-16)

## Livré

| Zone | Fichiers |
|------|----------|
| Gate docs | `docs/decisions/2026-07-16-openpay-congo-docs-gate.md` |
| Migrations | `028_unify_billing_plans.sql`, `029_openpay_billing.sql` |
| Packages | `@loyala/domain-billing`, `integrations/billing/openpay-cg`, validation billing, events |
| Worker | `/billing/webhook`, `/billing/health`, Inngest poll + renewal |
| Web | `/billing`, `/checkout`, `/success`, `/cancelled`, `/history`, `/invoices` |
| Env/docs | `.env.example`, `docs/OPENPAY-INTEGRATION.md` |

## Endpoints

- `POST https://api.openpay-cg.com/v1/transaction/payment`
- Worker `POST /billing/webhook`, `GET /billing/health`
- Inngest: `loyala-billing-payment-poll`, `loyala-billing-renewal`

## Tables

`subscriptions`, `payments`, `invoices`, `payment_events`, `payment_logs`

## Stripe

`STRIPE_SECRET_KEY` purged from validation schema.

## Risques restants

1. Webhook/status/refund OpenPay Congo **non documentés** — stubs + polling path optionnel
2. Prod web still needs Vercel deploy for UI
3. Apply migrations 028/029 on Supabase before enabling `BILLING_ENABLED=true`
4. Plan lock trigger: JWT cannot self-upgrade; RPC service_role required
