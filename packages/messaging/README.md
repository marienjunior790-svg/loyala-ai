# @loyala/messaging

Message Router + Channel Adapter (ADR-010).

## Responsabilité

- **`OutboundMessage`** — message métier canonique (source IA), jamais couplé à Meta
- **`MessageRouter`** — opt-in, session 24h, intent → mode (`api_text` | `api_template` | `deep_link` | `skipped`)
- **`TemplateMapper`** — message métier → variables `{{n}}` sur templates catalogue approuvés
- **`deliverOutboundMessage`** — point d'entrée unique sortant

Le Campaign Engine (`@loyala/core-ai`) ne dépend pas de ce package.

## Usage (worker)

```typescript
import {
  campaignTypeToIntent,
  createClosedSessionContext,
  deliverOutboundMessage,
  resolveTemplateCatalog,
} from '@loyala/messaging';

const result = await deliverOutboundMessage(
  {
    organizationId,
    clientId,
    channel: 'whatsapp',
    body: messageBody,
    phone,
    optIn: true,
    intent: campaignTypeToIntent('inactive'),
    metadata: { clientName, restaurantName },
  },
  createClosedSessionContext({
    apiEnabled: true,
    templateCatalog: resolveTemplateCatalog({
      templateName: process.env.WHATSAPP_CAMPAIGN_TEMPLATE_NAME, // optionnel — pilote hello_world
      templateLanguage: process.env.WHATSAPP_CAMPAIGN_TEMPLATE_LANGUAGE,
    }),
  })
);
```

## Variables d'environnement (worker)

| Variable | Effet |
|----------|--------|
| `WHATSAPP_API_ENABLED=true` | Active les modes API |
| `WHATSAPP_CAMPAIGN_TEMPLATE_NAME` | Override pilote (ex. `hello_world`) ; **absent** = catalogue `loyala_*_v1` par intent |
| `WHATSAPP_CAMPAIGN_TEMPLATE_LANGUAGE` | Langue template (défaut `fr`) |

## Tests

```bash
npx vitest run packages/messaging
```

## Phases ADR-010

| Phase | Statut |
|-------|--------|
| 0–1 Router + WhatsApp adapter + catalogue seed | ✅ |
| 3 `message_template_catalog` + Meta submit | ✅ migration 024 + worker `loadTemplateCatalog` |
| 3 Templates Meta approuvés en prod | Ops Meta |
| 5+ SMS / Email adapters | À faire |
