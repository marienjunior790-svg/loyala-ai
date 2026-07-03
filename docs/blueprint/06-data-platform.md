# Data Platform

## Couches

```
OLTP (PostgreSQL/Supabase) → domain_events → ETL → Warehouse (J3) → Marts → Dashboards
```

## Tables opérationnelles (source de vérité)

| Domaine | Rétention |
|---------|-----------|
| IAM, CRM, Billing | Permanent |
| Messages inbox | 12 mois actif |
| Campaign deliveries | 24 mois |
| AI logs | 90j–24 mois |
| Audit / domain_events | 36 mois min |

## Marts analytiques

| Mart | Refresh | Usage |
|------|---------|-------|
| mart_org_daily | Nightly | KPI dashboard |
| mart_campaign_performance | Hourly | Campagnes |
| mart_saas_metrics | Monthly | Finance MRR/churn |
| mart_ai_costs | Hourly | Budget IA |

**MVP :** vues matérialisées PostgreSQL. **J3 :** ClickHouse/BigQuery.

## Pipelines ETL

- `aggregate_org_kpis` — nightly
- `compute_segments` — nightly
- `ai_cost_rollup` — hourly
- `anonymize_deleted` — daily

## Gouvernance

- PII : chiffrement, masquage logs
- Accès warehouse : service account uniquement
- Effacement client : < 30 jours
- Benchmarks secteur : k-anonymity ≥ 50 orgs (opt-in)
