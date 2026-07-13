# ADR-010: Message Router + Channel Adapter

**Statut:** Accepté  
**Date:** 2026-07-13  
**Remplace / complète:** pilote WhatsApp actuel (`whatsapp-auto-send`, `hello_world`)

## Contexte

Loyala génère des messages personnalisés par IA (anniversaires, inactifs, promotions) via `@loyala/core-ai`. Aujourd’hui :

1. Le texte IA est **persisté** dans `campaign_sends.message_body` et exposé via liens `wa.me`.
2. L’auto-send API WhatsApp envoie un **template Meta fixe** (`hello_world`) — le `message_body` n’est jamais transmis à Graph API.
3. Le worker connaît Meta directement (`sendWhatsAppMessage`, env `WHATSAPP_*` dans les jobs campagne).

Le produit doit évoluer vers :

- Envoi API du **contenu métier** (personnalisé IA) en restant conforme WhatsApp Cloud API.
- Multi-canal (SMS, Email, RCS, Messenger) sans refonte du Campaign Engine.
- Inbox intelligente et réponses automatiques (fenêtre session 24 h).

**Principe fondateur :** l’IA ne choisit jamais entre « message libre » et « template Meta ». Elle produit un **message métier canonique**. Une couche d’adaptation décide **comment** le délivrer selon le canal et ses règles.

## Décision

### Architecture cible

```
Campaign Engine (core-ai)
        │
        ▼
Message métier canonique          ← source de vérité (DB + UI)
        │
        ▼
Message Router                    ← opt-in, session, canal préféré, intent
        │
        ▼
Channel Adapter (par canal)       ← WhatsApp | SMS | Email | RCS | Messenger
        │
        ▼
Provider                          ← Meta Graph, Twilio, Resend, …
```

Le **Campaign Engine** émet une intention unique :

> « Délivrer ce message métier à ce client pour cette campagne. »

Il ne connaît ni Meta, ni templates, ni `wa.me`.

### Message Router — arbre de décision (WhatsApp)

Pour chaque destinataire :

| Condition | Action |
|-----------|--------|
| Pas d’opt-in canal | **Skip** — ne rien envoyer |
| Session ouverte (< 24 h depuis dernier inbound) | **Meta `type: text`** — message IA intégral |
| Session fermée + template approuvé disponible | **Meta `type: template`** — variables remplies depuis le message IA |
| Session fermée + aucun template utilisable | **Fallback `wa.me`** — deep link avec texte IA |
| Mapping template échoue (longueur, slots) | **Fallback `wa.me`** — jamais d’envoi API dégradé |

Enrichissements router (tous canaux) :

- Canal préféré client (`whatsapp` > `sms` > `email` selon opt-ins).
- Qualité WABA / rate limits / créneaux d’envoi (futur).
- `campaign_send_id` et `organization_id` propagés pour traçabilité.

### Moteur de templates IA (Template Mapper)

Meta n’accepte pas une structure de template inventée à l’exécution. Seuls des templates **pré-approuvés** peuvent partir en business-initiated.

Le moteur ne **crée** pas le gabarit Meta au runtime — il **mappe** le message métier vers un template du **catalogue approuvé** :

```
Message métier (IA)
        │
        ▼
Intent classifier          birthday | inactive | loyalty | promo | …
        │
        ▼
Template catalog           templates Meta approuvés par intent
        │
        ▼
Slot extractor (IA)        découpe le message en {{1}}, {{2}}, {{3}}
        │
        ▼
Constraint validator       longueurs max Meta, nb variables, caractères
        │
        ▼
Meta payload               { name, language, components }
```

**Exemple :**

| Couche | Valeur |
|--------|--------|
| Message IA (canonique) | « Bonjour Marie ! Vous n'êtes pas venue depuis un moment. Cette semaine nous vous offrons un dessert. À bientôt chez Restaurant Soleil. » |
| Template catalog | `loyala_inactive_v1` — « Bonjour {{1}}. {{2}} À bientôt chez {{3}} » |
| Variables | `{{1}}=Marie`, `{{2}}=Cette semaine nous vous offrons un dessert`, `{{3}}=Restaurant Soleil` |

`campaign_sends.message_body` conserve le texte IA complet. `whatsapp_messages` enregistre template + variables résolues + statuts webhook.

### Channel Adapter — contrat unique

Tous les canaux implémentent la même interface (package dédié, voir ci-dessous).

#### Types conceptuels

```typescript
/** Message métier — jamais couplé à un provider */
interface OutboundMessage {
  organizationId: string;
  clientId: string;
  campaignSendId?: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'rcs' | 'messenger';
  body: string;                    // message métier canonique (source IA)
  locale?: string;
  intent: 'birthday' | 'inactive' | 'loyalty' | 'promo' | 'transactional' | 'reply';
  metadata?: Record<string, unknown>;
}

interface DeliveryResult {
  channel: string;
  mode: 'api_text' | 'api_template' | 'deep_link' | 'skipped';
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  externalId?: string;             // wamid, sms_sid, email_id, …
  resolvedPayload?: unknown;       // ce que le provider a réellement envoyé
  skipReason?: string;
  errorMessage?: string;
}
```

#### Adapters

| Adapter | Modes | Notes |
|---------|-------|-------|
| **WhatsApp** | `api_text`, `api_template`, `deep_link` | Session 24 h, catalogue templates, opt-in |
| **SMS** | `api_text` | Twilio / autre, pas de template Meta |
| **Email** | `api_html` / `api_text` | Resend, sujet + corps dérivés du message métier |
| **RCS** | `api_rich` / `api_text` | Couverture opérateur variable |
| **Messenger** | `api_template`, `api_text` | Règles Meta proches WhatsApp |

Le router choisit le **canal** ; l’adapter choisit le **mode** dans ce canal.

### Modèle de données (nouvelles tables)

Migration future (ex. `023_messaging_platform.sql`) — schéma cible :

#### `conversation_sessions`

État session par client et canal (fenêtre 24 h, inbox).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | |
| `organization_id` | UUID FK | Tenant |
| `client_id` | UUID FK | |
| `channel` | TEXT | `whatsapp`, `messenger`, … |
| `external_address` | TEXT | E.164 phone ou PSID |
| `last_inbound_at` | TIMESTAMPTZ | Dernier message entrant |
| `last_outbound_at` | TIMESTAMPTZ | Dernier message sortant |
| `session_open` | BOOLEAN GENERATED | `last_inbound_at > now() - interval '24 hours'` (ou colonne maintenue par trigger) |
| `metadata` | JSONB | Provider-specific |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Index : `(organization_id, client_id, channel)` unique.

Alimenté par webhooks **entrants** (`messages`, pas seulement `statuses`).

#### `message_template_catalog`

Templates Meta (et autres) approuvés — asset produit, pas génération runtime.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | |
| `organization_id` | UUID FK NULL | NULL = template plateforme Loyala |
| `channel` | TEXT | `whatsapp` |
| `intent` | TEXT | `birthday`, `inactive`, … |
| `provider_template_name` | TEXT | ex. `loyala_inactive_v1` |
| `language` | TEXT | `fr`, `en` |
| `body_pattern` | TEXT | « Bonjour {{1}}. {{2}} — {{3}} » (documentation / validation) |
| `variable_count` | INT | Nombre de slots |
| `variable_specs` | JSONB | `[{ "slot": 1, "maxLength": 60, "role": "first_name" }, …]` |
| `category` | TEXT | `marketing`, `utility` |
| `status` | TEXT | `draft`, `pending_approval`, `approved`, `rejected` |
| `approved_at` | TIMESTAMPTZ | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

RLS : lecture par org ; écriture admin plateforme ou org_owner pour templates custom futurs.

#### Évolution tables existantes

| Table | Rôle |
|-------|------|
| `campaign_sends.message_body` | **Source de vérité** message métier (inchangé) |
| `campaign_sends.whatsapp_url` | Fallback deep link (inchangé) |
| `whatsapp_messages` | Journal technique : mode, template, variables, wamid, statuts |
| `whatsapp_messages` + colonne optionnelle `resolved_body` | Texte tel que reçu par le client (template résolu ou texte session) |

### Flux de données

#### Sortant (campagne)

```
Inngest cron / action manuelle
  → Campaign Engine → plans[].content.message
  → persistCampaignPlans → campaign_sends (message_body, pending)
  → deliverOutboundMessage(OutboundMessage)
       → MessageRouter.resolve()
       → WhatsAppAdapter.deliver()
            → session? text : template mapper : wa.me
       → insert whatsapp_messages + update campaign_sends.status
```

#### Entrant (inbox — futur)

```
Webhook Meta (messages + statuses)
  → InboundAdapter.normalize()
  → upsert conversation_sessions.last_inbound_at
  → (optionnel) Inbox / IA reply → OutboundMessage → même router
```

### Packages monorepo

| Package | Responsabilité |
|---------|----------------|
| `@loyala/core-ai` | Génération message métier — **inchangé**, sans dépendance canal |
| `@loyala/messaging` (nouveau) | `OutboundMessage`, `DeliveryResult`, `MessageRouter`, `deliverOutboundMessage()` |
| `@loyala/messaging/adapters/whatsapp` | Session, template mapper, Meta + wa.me |
| `@loyala/messaging/adapters/sms` | Twilio |
| `@loyala/messaging/adapters/email` | Resend |
| `@loyala/domain-crm` | Persistance `campaign_sends`, `whatsapp_messages`, catalog CRUD |
| `packages/integrations` | **Clients HTTP providers uniquement** — déplacer la logique router hors de `messaging/index.ts` |
| `apps/worker` | Appelle `deliverOutboundMessage` — supprime logique canal dans `whatsapp-auto-send.ts` |

**Inviolable :** aucun import Meta / Twilio / Resend depuis `core-ai` ou `domain-crm` campaign-automation.

### Phasage d’implémentation

| Phase | Livrable | Critère de done |
|-------|----------|-----------------|
| **0** | ADR-010 + types `OutboundMessage` / `DeliveryResult` | Contrat documenté, tests unitaires router (mocks) |
| **1** | `MessageRouter` + `WhatsAppAdapter` (session stub, template catalog en seed) | Fin de `hello_world` aveugle ; fallback wa.me |
| **2** | Migration `conversation_sessions` + webhook inbound `messages` | ✅ `023_conversation_sessions.sql` + `parseMetaWebhookInboundMessages` |
| **3** | `message_template_catalog` + Slot Extractor IA | ✅ DB catalog + `loadTemplateCatalog` + scripts Meta |
| **4** | Refactor worker : `autoSendCampaignForTestClient` → `deliverOutboundMessage` | E2E test client |
| **5** | `SmsAdapter` (Twilio) | Premier second canal |
| **6** | `EmailAdapter` campagnes | Resend unifié |
| **7** | Inbox inbound + réponses IA | Router bidirectionnel |

Chaque phase respecte l’architecture cible ; aucune phase ne nécessite de jeter la précédente.

### État actuel → cible (dette à retirer)

| Aujourd’hui | Cible |
|-------------|-------|
| `whatsapp-auto-send.ts` appelle `type: 'template'` + `hello_world` | `deliverOutboundMessage()` via router |
| `body` ignoré dans `buildTemplatePayload` | Template mapper ou `api_text` |
| Webhook traite `statuses` seulement | + `messages` pour sessions |
| Dashboard lit `campaign_sends` seulement | + statuts `whatsapp_messages` (livraison Meta) |
| `packages/integrations/messaging` = router de fait | Providers thin ; router dans `@loyala/messaging` |

## Alternatives rejetées

### Envoyer `message_body` en `type: text` sur campagnes froides

**Rejeté** — Violation WhatsApp Cloud API (business-initiated). Rejet Graph API, risque qualité WABA.

### Garder uniquement `wa.me` sans API

**Rejeté** — Pas de traçabilité livraison, pas d’automatisation complète, pas d’inbox. Acceptable comme **fallback**, pas comme stratégie unique.

### Générer la structure template Meta à la volée par IA

**Rejeté** — Meta exige approbation préalable. Le mapper remplit des slots sur des templates **catalogués**, il n’invente pas le gabarit.

### Un adapter WhatsApp par feature (campagnes, inbox, test)

**Rejeté** — Duplication des règles session/template. Un seul `WhatsAppAdapter` + router.

### Coupler le Campaign Engine à Meta pour « aller plus vite »

**Rejeté** — Bloque SMS, Email, inbox. Viole le principe plateforme CRM.

## Conséquences

### Positives

- **Évolutivité** — Nouveaux canaux = nouvel adapter, pas de refonte campagnes.
- **Conformité Meta** — Template catalog + session store explicites.
- **Cohérence produit** — Un message métier, plusieurs modes de délivrance.
- **Inbox** — Même pipeline entrant/sortant.
- **Testabilité** — Router testable sans appels Graph API.

### Négatives / compromis

- **Complexité** — Nouveau package + 2 tables + webhook inbound.
- **Ops Meta** — Cycle approbation templates (jours/semaines).
- **Migration** — Refactor `whatsapp-auto-send` et routes worker.
- **Slot extractor** — Appel IA supplémentaire (coût tokens) ou heuristique + validation ; à optimiser en cache par intent.

## Références

- ADR-004 AI Platform Provider Abstraction (même pattern pour messaging)
- ADR-005 Inngest Event Bus (cron campagnes inchangé en amont)
- ADR-009 AI Automation Engine (Campaign Engine amont)
- [docs/runbooks/meta-whatsapp-templates.md](../runbooks/meta-whatsapp-templates.md)
- Migration `022_whatsapp_messages.sql`
- `scripts/verify-022-whatsapp-messages.mjs`

## Checklist revue (avant Phase 1 code)

- [x] Tests unitaires router : 4 branches + fallback mapping échoué
- [x] Package `@loyala/messaging` — Router + WhatsAppAdapter + TemplateMapper
- [x] Worker `createWorkerMessagingContext` lit `conversation_sessions`
- [x] Webhook inbound `messages` → `last_inbound_at`
- [ ] Migration 023 appliquée en production (`pnpm db:verify-023`)
- [ ] Templates Meta **soumis** et **approuvés** chez Meta (`pnpm whatsapp:submit-templates`)
- [ ] DB templates marqués `approved` (`pnpm whatsapp:approve-templates`)
