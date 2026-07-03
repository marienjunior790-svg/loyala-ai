# Ecosystem Strategy

## Programme partenaires

| Tier | Profil | Obligations |
|------|--------|-------------|
| Registered | Intégrateur | 1 intégration/an |
| Silver | 5+ clients | Certification dev |
| Gold | 20+ clients | QBR trimestriel |
| Technology | POS, compta | Certification sécurité |

## Certification développeurs

| Niveau | Prérequis |
|--------|-----------|
| Certified Developer | Tutorial + quiz + mini-projet |
| Certified Integrator | 1 intégration prod + revue sécu |
| Certified Architect | 3 intégrations + cas pratique |

## Documentation publique (J3)

- `developers.loyala.ai/api` — OpenAPI
- `npm @loyala/sdk`
- `status.loyala.ai` (J2)

## Catalogue intégrations

| Priorité | Intégration |
|----------|-------------|
| P0 | WhatsApp, Google Business |
| P1 | Stripe, Paystack |
| P2 | POS partenaire |
| P3 | Compta, livraison |

## Gouvernance extensions

- Review sécurité obligatoire
- Scopes minimaux
- Accès API uniquement (jamais DB directe)
- Revenue share 15–30% (Acte 3)
- Suspension possible en 24h

## Préparation dès v1

1. UI slots documentés
2. Webhooks sortants
3. API keys scoped
4. Events versionnés stables
5. `marketplace.enabled = false`
