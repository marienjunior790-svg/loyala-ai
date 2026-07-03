# Plan de validation — Loyala AI

**Objectif shift :** arrêter l'infrastructure, **valider le produit de bout en bout**.

Aucune nouvelle fonctionnalité avant validation complète Phase A.

**Guide d'exécution :** [`GO-LIVE-EXECUTION.md`](./GO-LIVE-EXECUTION.md) ← ordre officiel §1→§5

---

## Sprint 1 — Go-Live technique (obligatoire)

**Objectif :** plateforme techniquement stable.

| # | Tâche | Runbook |
|---|-------|---------|
| 1 | Configurer secrets Railway + Vercel | [`sprint-1-go-live.md`](../runbooks/sprint-1-go-live.md) §1 |
| 2 | Appliquer migrations Supabase 001→005 | §2 |
| 3 | Vérifier backend Railway (`/health`, `/ai/*`) | §3 |
| 4 | Vérifier frontend Vercel (`/api/health`, auth) | §4 |
| 5 | Exécuter checklist Go-Live complète | [`production-checklist.md`](../runbooks/production-checklist.md) |
| 6 | Corriger bugs bloquants | Rapport § Bugs |

**Gate Sprint 1 :** tous les items § Services + § Migrations + § Endpoints du [rapport Go-Live](./go-live-report.md) = ✅

---

## Sprint 2 — Validation fonctionnelle (priorité produit)

**Objectif :** le cœur Loyala fonctionne pour un vrai utilisateur.

Ordre de test strict :

| # | Parcours | Statut code | Notes |
|---|----------|-------------|-------|
| 1 | Création compte | ✅ Implémenté | `/signup` |
| 2 | Création organisation | ✅ Implémenté | `/onboarding` |
| 3 | Invitation collaborateur | ⚠️ **Non implémenté UI** | Permission `team:invite` existe, pas de flow |
| 4 | Connexion / déconnexion | ✅ Implémenté | `/login`, logout |
| 5 | Création client | ✅ Implémenté | `/clients/new` |
| 6 | Modification client | ✅ Implémenté | `/clients/[id]/edit` |
| 7 | Suppression client | ✅ Implémenté | soft delete |
| 8 | Permissions RBAC | ⚠️ Partiel | IAM package + policies, tests unitaires |
| 9 | Isolation données inter-orgs | ✅ RLS + tests | `pnpm test:rls` avec secrets |

Runbook détaillé : [`sprint-2-functional-validation.md`](../runbooks/sprint-2-functional-validation.md)

**Gate Sprint 2 :** parcours 1–2, 4–9 validés manuellement en prod/staging ; #3 documenté comme backlog Sprint 3 ou blocker.

---

## Sprint 3 — Intégrations (après gate Sprint 2)

| Module | Prérequis |
|--------|-----------|
| WhatsApp | Sprint 2 ✅ |
| OpenAI / Anthropic | Sprint 1 worker ✅ |
| Google Reviews | Sprint 2 ✅ |
| Billing Stripe/Paystack | Sprint 2 ✅ |
| Notifications | Sprint 2 ✅ |

---

## Rapport exigé avant reprise du dev

Remplir et signer : [`go-live-report.md`](./go-live-report.md)

Critères minimum :

- ✅ Tous les services démarrent
- ✅ Migrations appliquées
- ✅ Endpoints API répondent
- ✅ Tests automatisés au vert
- ✅ Parcours critiques validés
- ✅ Aucune erreur critique logs Railway/Vercel/Supabase
- ✅ Performances acceptables

---

## Règle d'équipe

> **Pas de nouvelle feature tant que le rapport Go-Live n'est pas signé avec gates Sprint 1 + 2.**

Exceptions : bugs bloquants découverts pendant la validation.
