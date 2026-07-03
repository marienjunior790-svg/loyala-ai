# API, Marketplace & Multi-produits

## API publique v1

- Versioning URL `/api/v1/`
- Auth : API keys scoped + OAuth2 (J3)
- Pagination cursor-based
- OpenAPI 3.1 source de vérité : `packages/api-spec/`
- SDK : `@loyala/sdk`

## Rate limits

| Plan | Req/heure |
|------|-----------|
| Starter | 500 |
| Growth | 5 000 |
| Enterprise | 50 000 |

## Marketplace (Acte 3, hooks dès v1)

- Extensions : UI slots, API scoped, webhooks
- Tables réservées : `marketplace_extensions`, `organization_extensions`
- Préparation : webhooks sortants, API keys, events stables

## Multi-produits

`VerticalConfig` par secteur : labels, segments, champs custom, modules activés.

| Verticale | Label client |
|-----------|--------------|
| horeca | Client |
| hotel | Client / Guest |
| health | Patient |
| retail | Client |

MVP : table `clients` dédiée horeca. Migration future vers `entities` sans perte.
