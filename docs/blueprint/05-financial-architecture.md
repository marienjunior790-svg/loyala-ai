# Financial Architecture

## Plans & pricing cible

| Plan | Mensuel | Cible |
|------|---------|-------|
| Starter | 49€ / 32k XOF | Indépendant |
| Growth | 149€ / 98k XOF | Restaurant établi |
| Enterprise | ≥ 399€ | Chaînes |

## COGS maximal par client / mois

| Poste | Starter | Growth | Enterprise |
|-------|---------|--------|------------|
| Infra | 2€ | 5€ | 15€ |
| WhatsApp | 3€ | 12€ | 40€ |
| SMS | 1€ | 3€ | 10€ |
| IA | 2€ | 8€ | 25€ |
| Support alloué | 3€ | 5€ | 15€ |
| **Total COGS max** | **11.50€** | **34€** | **108€** |
| **Marge brute cible** | **≥ 80%** | **≥ 80%** | **≥ 75%** |

**Marge brute plateforme cible : ≥ 75%**

## Quotas WhatsApp inclus

| Plan | Messages/mois | Overage |
|------|-----------------|---------|
| Starter | 500 | 0.04€/msg |
| Growth | 3 000 | 0.03€/msg |
| Enterprise | 15 000 | Négocié |

## Budget IA

| Plan | Tokens/mois | Coût max | Overage |
|------|-------------|----------|---------|
| Starter | 100k | 2€ | Bloqué |
| Growth | 500k | 8€ | 0.01€/1k tokens |
| Enterprise | 2M | 25€ | Négocié |

## Break-even

- Coûts fixes estimés J2 : ~25k€/mois
- MRR break-even : ~35k€ (~280 clients au mix cible)

## Gate économique feature (obligatoire)

1. COGS marginal < 10% ARPU plan cible
2. Quotas documentés par plan
3. Kill switch (feature flag + budget cap)
4. ROI client estimable
