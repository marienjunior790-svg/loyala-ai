# Vision & Platform Architecture

## Vision 10 ans

**Thèse :** Loyala AI devient le système d'exploitation relationnel des PME de proximité en Afrique.

| Acte | Période | Positionnement |
|------|---------|----------------|
| 1 CRM IA Restaurants | 2025–2027 | HubSpot des restos africains, WhatsApp-native |
| 2 OS HORECA | 2027–2029 | Toast + SevenRooms adapté Afrique |
| 3 Super-app B2B | 2029–2032 | Marketplace, API, paiements |
| 4 Multi-verticale | 2032–2035 | Hôtel, santé, retail, immobilier |

## Architecture fonctionnelle

```
Verticale (horeca, hotel...) → Métier (CRM, campagnes, fidélité) → Cœur (IAM, AI, payments, notifications, analytics) → Infra
```

## Modules cœur

| Module | Package |
|--------|---------|
| IAM & Tenancy | `@loyala/core-iam` |
| AI Platform | `@loyala/core-ai` |
| Payments | `@loyala/core-payments` |
| Documents | `@loyala/core-documents` |
| Notifications | `@loyala/core-notifications` |
| Analytics & Events | `@loyala/core-analytics` |

## Modules métier

| Module | Package |
|--------|---------|
| CRM | `@loyala/domain-crm` |
| Engagement | `@loyala/domain-engagement` |
| Fidélité | `@loyala/domain-loyalty` |
| Inbox | `@loyala/domain-inbox` |
| Réputation | `@loyala/domain-reputation` |

## Applications

| App | Rôle |
|-----|------|
| apps/web | Dashboard restaurateur |
| apps/admin | Console Loyala |
| apps/marketing | Site public |
| apps/worker | Jobs async |
| apps/developer (J3) | Portail partenaires |

## Multi-tenant

Shared database, shared schema, `organization_id` + RLS sur toutes tables métier.
