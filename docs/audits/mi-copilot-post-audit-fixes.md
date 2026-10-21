# Corrections post-audit transversal — MI Copilot

**Date :** 2026-10-20 · diagnostic E repris le 2026-10-21  
**Réf. audit initial :** `docs/audits/mi-copilot-transversal-p21-p26.md` (PASS WITH LIMITATIONS)  
**Autorisation :** corrections locales A–E uniquement — pas de commit / push / deploy / migration / WhatsApp. Pas de nouveau projet Supabase, pas de modification Railway, pas d’écriture prod.

---

## Verdict final

### **PASS WITH LIMITATIONS**

| Objectif | Statut |
|---|---|
| A — Troncature avis | **FAIT** |
| B — Clarification périodes | **FAIT** |
| C — Test combiné multi-signaux | **FAIT** |
| D — Visibilité cockpit P2.3–P2.6 | **FAIT** |
| E — Validation UI authentifiée | **BLOCKED** |

Les tests unitaires / d’intégration locaux sont verts (**168 PASS** sur la suite MI/Bomaye élargie).  
**Verdict E : BLOCKED.** L’UI authentifiée n’a pas été parcourue. Ne pas confondre avec un PASS UI.

---

## Correctifs réalisés

### A. Troncature des avis
- `countReviews` (count PostgREST exact) + `listReviews` en parallèle dans `loadMiOrgInsights`.
- `MiReviewsInsight` : `sampleFetchLimit`, `totalMatchingInWindow`, `sampleComplete` (`true` / `false` / `null`).
- `false` = troncature **prouvée** (total > chargé) ; `null` = plafond atteint **sans** count fiable (incertitude, jamais inventée comme « complet »).
- Briefing + bridge : moyenne non présentée comme exhaustive si `sampleComplete !== true`.
- Cockpit : badge / avertissement « non exhaustif ».

### B. Périodes
- `measurementWindows` sur le snapshot (`dashboard`, `recency_sliding`, `reviews`, `campaigns`) via `buildMiMeasurementWindows`.
- Exposé API (`miInsightsForPrompt`), briefing (limites si fenêtre non alignée), cockpit (liste des fenêtres).

### C. Test combiné
- `packages/domain-crm/src/mi-combined-signals-p2x.test.ts` : CA↓ + visites↓ + livraison↑ + avis↓ + pending ; scénario données manquantes ; isolation org ; complétude avis.

### D. Cockpit
- Section `mi-measurement-windows`.
- Cartes `mi-extended-signals` (livraison, avis, récence, campagnes).
- Briefing : affichage initial 6 items + bouton « Voir N signal(s) supplémentaire(s) » (`mi-briefing-expand`).

### E. UI authentifiée — verdict **BLOCKED** (2026-10-21)

Diagnostic (aucune valeur secrète recopiée) :

| Contrôle | Résultat |
|---|---|
| Noms attendus par le code | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`apps/web/lib/supabase/env.ts`, `middleware.ts`, `client.ts`, `server.ts`). `SUPABASE_SERVICE_ROLE_KEY` sert aux actions serveur, pas au login navigateur. |
| `apps/web/.env.local` | Fichier gitignoré (`.gitignore` : `.env*`). Les deux variables publiques sont **présentes**. |
| Forme de `NEXT_PUBLIC_SUPABASE_URL` | **Invalide** : longueur 11, pas une URL `http`/`https`. Ce n’est pas une absence, ni un libellé placeholder connu (`placeholder`, `changeme`, `REDACTED`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Présente, longueur 11 — trop courte pour une clé anon JWT. |
| `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL` | **Absentes** du fichier local. Non requises pour afficher `/login`. |
| `.env.development.local` | Ne définit pas les variables Supabase (ne les corrige pas). |
| `vercel env pull` environnement `development` | N’a fourni que `VERCEL_OIDC_TOKEN`. Pas d’URL Supabase de développement sur Vercel. |
| Middleware | Lit exactement ces deux variables et appelle `createServerClient`. Avec l’URL actuelle : `Invalid supabaseUrl`. |
| Navigateur | `GET /login` échoue dans le middleware. Pas de formulaire, pas de session. |
| Compte de test dans le dépôt | **Aucun** identifiant seedé. Impossible de vérifier l’existence d’un utilisateur Supabase tant que l’URL est invalide. |
| Actions non faites | Pas de projet Supabase créé, pas de compte créé, pas de changement de rôle, pas de clé prod copiée, pas de redémarrage (config encore invalide), aucun JWT journalisé. |

---

## Fichiers modifiés (principaux)

- `packages/domain-crm/src/reviews.ts`
- `packages/domain-crm/src/mi-reviews.ts`
- `packages/domain-crm/src/mi-tools.ts`
- `packages/domain-crm/src/mi-proactive-briefing.ts`
- `packages/domain-crm/src/knowledge/bomaye-crm-bridge.ts`
- `packages/domain-crm/src/mi-combined-signals-p2x.test.ts` *(nouveau)*
- Fixtures tests P2.x / web (`measurementWindows: []`)
- `apps/web/lib/mi/format-insights.ts`
- `apps/web/components/mi/mi-cockpit.tsx`
- `docs/audits/mi-copilot-post-audit-fixes.md` *(ce rapport)*

---

## Tests exécutés (observés)

```bash
npx vitest run packages/domain-crm/src/mi-campaign-activity-p26.test.ts \
  packages/domain-crm/src/mi-recency-loyalty-p25.test.ts \
  packages/domain-crm/src/mi-reviews-p24.test.ts \
  packages/domain-crm/src/mi-delivery-share-p23.test.ts \
  packages/domain-crm/src/client-dashboard-delivery-p23.test.ts \
  packages/domain-crm/src/knowledge/bomaye-crm-bridge.test.ts \
  packages/domain-crm/src/mi-proactive-briefing.test.ts \
  packages/domain-crm/src/knowledge/bomaye-pack.test.ts \
  packages/domain-crm/src/mi-tools.test.ts \
  packages/domain-crm/src/mi-customer-intelligence.test.ts \
  packages/domain-crm/src/mi-campaign-intelligence.test.ts \
  packages/domain-crm/src/mi-combined-signals-p2x.test.ts \
  apps/web/lib/mi \
  apps/web/tests/mi-insights-route.test.ts \
  apps/web/tests/mi-cockpit-p1.test.ts
```

**Résultat :** `Test Files  20 passed (20)` · `Tests  168 passed (168)` · exit **0**

---

## Preuves UI

| Preuve | Résultat |
|---|---|
| Serveur local `:3000` Ready (session précédente) | **Oui**, puis middleware en erreur dès qu’une requête auth part |
| Env local Supabase utilisable | **Non** — URL présente mais non HTTP(S), longueur 11 |
| Redémarrage après ce diagnostic | **Non** — config toujours invalide |
| Chargement `/login` | **Échec** middleware (`Invalid supabaseUrl`) |
| Chargement `/marketing-intelligence` authentifié | **Non obtenu** |
| Briefing / périodes / indicateurs en runtime | **Non obtenu** |
| Console / réseau auth MI | **Non obtenu** |
| Isolation org / permissions en UI | **Non obtenu** (couvert en tests unitaires / route mock uniquement) |
| Secrets / JWT dans ce rapport | **Aucun** |

---

## Limites restantes

1. Validation UI auth toujours ouverte (E) — **bloquée par env local invalide + absence de compte test**.
2. Plafonds campagnes/visites : flags truncation moins riches que les avis (inchangé hors périmètre strict).
3. Smoke cockpit source (`mi-cockpit-p1`) ≠ preuve navigateur.

---

## Suite pour sortir de BLOCKED

À faire par l’opérateur, **sans coller les secrets dans le chat** :

1. Ouvrir le projet Supabase **déjà existant et non production** → **Project Settings → API**.
2. Copier dans `apps/web/.env.local` (fichier déjà gitignoré) :
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL` (doit commencer par `https://`)
   - clé **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Ne pas y mettre `SUPABASE_SERVICE_ROLE_KEY` pour ce test UI. Ne pas réutiliser les variables **Production** Vercel sans accord explicite. Ne pas créer un nouveau projet.
4. Prévenir ici que le fichier est corrigé (sans en montrer le contenu). Le serveur Next ne sera redémarré qu’après ça.
5. Compte : aucun compte de test prouvé dans le dépôt. Après `/login` utilisable, soit un compte **déjà existant** sur ce projet (rôle `org_viewer` ou plus : `analytics:read`), soit création manuelle via `/signup` puis onboarding (le owner de la nouvelle org a `analytics:read`). `org_staff` est refusé. Pas de création de compte ni de changement de permission sans accord.
6. Ensuite seulement : `/login` → session → `/marketing-intelligence` (briefing, fenêtres, cartes P2.3–P2.6, console/réseau, refus sans permission). PASS uniquement avec cette preuve.
