# Meta WhatsApp templates — Loyala platform (Phase 3)

Templates marketing FR pour campagnes business-initiated. Le worker mappe le **message IA** vers les variables template.

## Catalogue (corps actuels — `scripts/data/meta-whatsapp-templates.json`)

| Nom Meta | Intent | Langue | Variables |
|----------|--------|--------|-----------|
| `loyala_birthday_v1` | birthday | `fr` | `{{1}}` nom, `{{2}}` offre |
| `loyala_inactive_v1` | inactive | `fr` | `{{1}}` nom, `{{2}}` message |
| `loyala_loyalty_v1` | loyalty | `fr` | `{{1}}` nom, `{{2}}` points |
| `loyala_promo_v1` | promo | `fr` | `{{1}}` civilité, `{{2}}` promo |

## État (P1 — 2026-07-15)

| Couche | État |
|--------|------|
| Soumis Meta | Oui (4/4) — dernière vérification : **PENDING** |
| DB `message_template_catalog` | `pending_approval` (4/4) |
| Token ops `WHATSAPP_ACCESS_TOKEN` | **Expiré** (USER token ~24h) — renouveler System User permanent |
| Mode compte | Test number + `biz_verify=not_verified` — Option B Live en cours |

Tant que Meta est PENDING : le worker utilise le **catalogue code** en fallback + `hello_world` pour les pilotes.

## Procédure

### 1. Migration 024 (+ 025 sécurité)

```bash
node scripts/apply-migration-file.mjs 024_message_template_catalog.sql
node scripts/verify-024-message-template-catalog.mjs
```

### 2. Soumettre / re-vérifier Meta

```bash
# Depuis .env.ops.local (token permanent recommandé)
node scripts/submit-meta-whatsapp-templates.mjs
node scripts/check-meta-template-status.mjs
node scripts/check-meta-production-readiness.mjs
```

### 3. Marquer approuvé en base

Quand Meta affiche **Approved** :

```bash
node scripts/mark-meta-templates-approved.mjs
# ou sélection :
node scripts/mark-meta-templates-approved.mjs loyala_inactive_v1 loyala_birthday_v1
```

### 4. Pilote technique

```bash
# hello_world (toujours dispo en sandbox si destinataire allow-listé)
node scripts/whatsapp-pilot-send.mjs

# après approval :
# TEMPLATE_NAME=loyala_inactive_v1 TEMPLATE_LANG=fr node scripts/whatsapp-pilot-send.mjs
```

## Vérification E2E

1. Client test `opt_in_whatsapp` + `WHATSAPP_TEST_CLIENT_ID` sur Railway  
2. Auto-send → `deliveryMode: api_template`  
3. Webhook → `whatsapp_messages.status` delivered/read  
4. UI `/relances` → badges Envoyé / Remis / Lu  

## Références

- ADR-010 Phase 3  
- `packages/messaging/src/template-mapper.ts`  
- Meta : [Message Templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
