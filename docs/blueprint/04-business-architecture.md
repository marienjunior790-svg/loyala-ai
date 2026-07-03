# Business Architecture

## Organisation cible

```
CEO / Fondateurs
├── Product (+ Design, AI Research)
├── Engineering (Platform, Product Eng, Data Eng)
├── Go-to-Market (Sales, CS, Marketing, Partners)
└── Operations (Support, Finance, People)
```

## Équipes — Responsabilités & KPI

### Product
**Responsabilités :** Vision, roadmap, discovery, métriques produit, conformité Blueprint.  
**KPI J2 → J3 :** Activation J14 ≥ 70% → 75% | TTV < 1h → 30min | NPS ≥ 40 → 50

### Engineering
**Responsabilités :** Modules cœur, CI/CD, sécurité, ADR, SLO.  
**KPI :** Uptime ≥ 99.5% → 99.9% | P95 API < 500ms → 300ms | Coverage ≥ 70% → 80% | MTTR P0 < 4h → 2h

### Design
**Responsabilités :** `@loyala/ui`, mobile-first, accessibilité WCAG AA.  
**KPI :** Task success ≥ 85% | Design system adoption ≥ 90%

### Sales
**Responsabilités :** Acquisition, pricing, pipeline, win/loss.  
**KPI J2 :** 100 clients payants | CAC < 450€ | Win rate ≥ 25%

### Customer Success
**Responsabilités :** Onboarding, adoption, expansion, churn prevention.  
**KPI :** Churn < 5% → 3% | NRR > 100% → 110% | Health score vert ≥ 70%

### Support
**Responsabilités :** Tier 1, KB, escalade, SLA par plan.  
**KPI :** First response < 4h → 2h | CSAT ≥ 4.0 → 4.3

### Finance
**Responsabilités :** Unit economics, billing ops, reporting SaaS.  
**KPI :** Marge brute ≥ 70% → 75% | Rule of 40 en trajectoire

### AI Research
**Responsabilités :** Prompts, eval, guardrails, routing modèles.  
**KPI :** Approval rate IA ≥ 75% | Coût IA < budget plan

## Interfaces (rituels)

| Rituel | Fréquence | Output |
|--------|-----------|--------|
| Sprint planning | Bi-hebdo | Backlog |
| SaaS metrics review | Mensuel | Dashboard MRR/churn |
| Blueprint review | Mensuel | Conformité ADR |
| Unit economics | Trimestriel | Ajustements plans |
| Customer advisory | Trimestriel | Roadmap input |

## RACI (extraits)

| Processus | Accountable | Responsible |
|-----------|-------------|-------------|
| Feature majeure | CEO | Product |
| Incident P0 | CTO | Eng Platform |
| Changement pricing | CEO | Finance |
| Onboarding client | CS Lead | CS |
