# OpenPay Congo — Gate documentation (Phase 0)

**Date:** 2026-07-16  
**Status:** Partial — public docs only

## Official sources (Congo only)

- https://www.openpay.cg/
- https://openpay.cg/docs/authentification

## Confirmed publicly

| Item | Value |
|------|-------|
| API base | `https://api.openpay-cg.com/v1` |
| Auth header | `XO-API-KEY` |
| Init payment | `POST /transaction/payment` |
| Body | `amount`, `payment_phone_number`, `provider` (`MTN`), optional `customer`, `customer_external_id`, `metadata` |
| Security | API key server-side only |

## NOT documented publicly (OpenPay Congo)

- Exact response schema / transaction ids / status enum
- Status polling endpoint
- Webhooks (events, signature, retries)
- Refunds
- Sandbox credentials flow

**Excluded:** `docs.openpay.co` (Mexico/Colombia Openpay) — different product.

## Production gate decision

Until private Postman/docs from the OpenPay Congo dashboard provide webhook + status + refund specs:

1. Ship **createPayment** + local `payments` persistence + **Inngest poll adapter** (typed stub if endpoint unknown)
2. Ship **webhook route** with typed stub verifier (`OPENPAY_WEBHOOK_SECRET` optional)
3. Do **not** claim refunds or signed webhooks as production-complete
4. Record raw payloads in `payment_logs` for later mapping

Account holders must paste private specs into §Sources of `docs/OPENPAY-INTEGRATION.md` before enabling `BILLING_ENABLED=true` in production with webhooks.
