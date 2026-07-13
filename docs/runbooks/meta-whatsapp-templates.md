# Meta WhatsApp templates — Loyala platform (Phase 3)

Templates marketing FR pour campagnes business-initiated. Le worker mappe le **message IA** vers les variables `{{1}}`, `{{2}}`, `{{3}}`.

## Catalogue

| Nom Meta | Intent | Corps |
|----------|--------|-------|
| `loyala_birthday_v1` | birthday | Bonjour {{1}}, {{2}} 🎉 — {{3}} |
| `loyala_inactive_v1` | inactive | Bonjour {{1}}. {{2}} À bientôt chez {{3}} |
| `loyala_loyalty_v1` | loyalty | Bonjour {{1}}, {{2}} — {{3}} |
| `loyala_promo_v1` | promo | {{1}} : {{2}}. {{3}} |

Définitions JSON : `scripts/data/meta-whatsapp-templates.json`

## Procédure

### 1. Appliquer migration 024

```bash
node scripts/apply-migration-file.mjs 024_message_template_catalog.sql
pnpm db:verify-024
```

Les seeds sont en `pending_approval`. Le worker utilise le **catalogue code** en fallback jusqu'à approbation DB.

### 2. Soumettre à Meta

```bash
export WHATSAPP_ACCESS_TOKEN="EAA..."
export WHATSAPP_BUSINESS_ACCOUNT_ID="123456789"
node scripts/submit-meta-whatsapp-templates.mjs
```

Suivre l'approbation dans **Meta Business Manager → WhatsApp → Message templates** (souvent 24–48 h).

### 3. Marquer approuvé en base

Quand Meta affiche **Approved** :

```bash
export DATABASE_URL="postgresql://..."
node scripts/mark-meta-templates-approved.mjs
# ou une sélection :
node scripts/mark-meta-templates-approved.mjs loyala_inactive_v1 loyala_birthday_v1
```

Le worker charge alors le catalogue depuis `message_template_catalog` (status `approved`).

### 4. Pilote technique `hello_world`

Toujours supporté pour tests sans templates Loyala :

```bash
WHATSAPP_CAMPAIGN_TEMPLATE_NAME=hello_world
```

## Vérification E2E

1. Client test avec `opt_in_whatsapp` + anniversaire ou campagne inactive
2. `WHATSAPP_TEST_CLIENT_ID` configuré sur Railway
3. Auto-send Inngest → logs `deliveryMode: api_template` + `templateName: loyala_inactive_v1`
4. Webhook Meta → `whatsapp_messages.status` delivered/read

## Références

- ADR-010 Phase 3
- `packages/messaging/src/template-mapper.ts` — slot extraction (heuristique)
- Meta : [Message Templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
