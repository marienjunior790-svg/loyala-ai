# WhatsApp Embedded Signup — architecture Loyala

## Flux

```
Browser (public App ID + Config ID)
  → Meta JS SDK (connect.facebook.net) — FB.login response_type=code
  → résultat temporaire (code + phone_number_id + waba_id via postMessage)
  → Loyala server action (session + cookie CSRF)
  → échange code → access_token (Graph, App Secret serveur)
  → validation Graph (phone / WABA)
  → chiffrement (LOYALA_SECRETS_ENCRYPTION_KEY)
  → upsert whatsapp_connections (organisation = session)
  → subscribe WABA webhooks (best-effort)
  → health check lecture seule
```

## Capacité (`canLaunch`)

| readiness | Condition |
|-----------|-----------|
| `not_configured` | `NEXT_PUBLIC_META_APP_ID` ou `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID` manquant |
| `server_not_ready` | IDs publics OK, mais `WHATSAPP_APP_SECRET` (ou `META_APP_SECRET`) ou chiffrement manquant |
| `ready_to_launch` | Public + secret app + chiffrement présents |
| `unavailable` | Réservé (feature flag futur) |

`canLaunch=true` uniquement pour `ready_to_launch`. Les secrets ne sont jamais renvoyés au client.

## Variables

| Variable | Visibilité | Rôle |
|----------|------------|------|
| `NEXT_PUBLIC_META_APP_ID` | Public | App ID Meta |
| `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID` | Public | Configuration ID Embedded Signup |
| `WHATSAPP_APP_SECRET` | Serveur | Canonique — webhook + OAuth exchange |
| `META_APP_SECRET` | Serveur | Alias si la canonique est vide |
| `LOYALA_SECRETS_ENCRYPTION_KEY` | Serveur | Chiffrement tokens org |

## Sécurité

- Organisation toujours dérivée de la session (`requireAuth`), jamais du body client.
- State OAuth HMAC + cookie httpOnly `loyala_wa_es_oauth` (anti-CSRF).
- Pas de `sessionInfoVersion` / `solutionID` (legacy v2/v3).
- Conflits multi-tenant : même Phone Number ID / WABA refusés s’ils appartiennent à une autre org.
- Webhook inbound : résolution Phone Number ID → connexion → organisation (jamais org depuis le payload Meta).

## CSP / domaines

Le SDK charge `https://connect.facebook.net/fr_FR/sdk.js`. Si une CSP stricte est ajoutée plus tard, autoriser ce script et les frames Meta (`facebook.com` / `facebook.net`).

## Migration

Schéma de base : migration `036` (`whatsapp_connections`). La migration `042` (durcissement / unicité) n’est **pas** appliquée automatiquement par ce socle — valider et appliquer séparément en production.
