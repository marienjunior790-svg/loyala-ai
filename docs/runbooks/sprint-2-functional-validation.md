# Sprint 2 — Validation fonctionnelle

Tester sur **staging ou prod** avec 2 comptes réels. Noter résultats dans [`go-live-report.md`](../validation/go-live-report.md) §5.

---

## Prérequis

- Sprint 1 ✅
- 2 emails de test (ex. `owner@test.com`, `viewer@test.com`)
- 2 navigateurs ou profils incognito

---

## 1. Création compte

1. Aller sur `/signup`
2. Email + mot de passe (min 8 chars)
3. Confirmer email si Supabase l'exige
4. **Attendu :** redirect onboarding ou login

| Résultat | ☐ ✅ ☐ ❌ |
|----------|-----------|
| Notes | |

---

## 2. Création organisation

1. Compléter `/onboarding` (nom, pays, fuseau, devise)
2. **Attendu :** redirect `/dashboard`, org visible dans `/settings`

| Résultat | ☐ ✅ ☐ ❌ |
|----------|-----------|
| Notes | |

---

## 3. Invitation collaborateur

> ⚠️ **Non implémenté** — pas de UI `/settings/team` ni flow invite.

| Résultat | ☐ N/A — backlog |
|----------|-----------------|
| Action | Reporter Sprint 3 ou implémenter avant gate |

---

## 4. Connexion / déconnexion

1. Logout depuis dashboard
2. Login `/login` avec mêmes identifiants
3. **Attendu :** retour dashboard, org cookie restauré

| Résultat | ☐ ✅ ☐ ❌ |
|----------|-----------|
| Notes | |

---

## 5–7. CRM clients

| Action | URL | Attendu |
|--------|-----|---------|
| Créer | `/clients/new` | Client dans liste |
| Modifier | `/clients/[id]/edit` | Champs persistés |
| Supprimer | fiche client | Disparaît liste (soft delete) |

| Création | ☐ ✅ ☐ ❌ |
| Modification | ☐ ✅ ☐ ❌ |
| Suppression | ☐ ✅ ☐ ❌ |

---

## 8. RBAC

1. Compte **org_owner** : accès settings, CRUD clients
2. Si compte **org_viewer** disponible : pas de delete / settings restreints

Vérifier `packages/core-iam` permissions vs actions server (`clients/_actions`).

| Résultat | ☐ ✅ ☐ ❌ ☐ Partiel |
|----------|---------------------|
| Notes | |

---

## 9. Isolation inter-organisations

**Test manuel :**

1. User A (org 1) crée client X
2. User B (org 2) — ne doit **pas** voir client X
3. DevTools → requête directe Supabase avec token B sur id client A → **RLS block**

**Test auto (CI local) :**

```bash
# Configurer secrets puis :
pnpm test:rls
```

| Manuel | ☐ ✅ ☐ ❌ |
| Auto RLS | ☐ ✅ ☐ ❌ ☐ Skipped |
| Notes | |

---

## Gate Sprint 2

Parcours 1, 2, 4, 5, 6, 7, 9 = ✅  
→ Signer rapport §10 → autoriser Sprint 3 intégrations
