# Audit transversal — Copilote marketing Loyala AI (P2.1 → P2.6)

**Date :** 2026-10-20  
**Nature :** audit & validation uniquement — **aucun correctif appliqué**, aucun commit / push / deploy / migration / envoi WhatsApp.  
**Verdict global :** **PASS WITH LIMITATIONS**

---

## 1. Résumé exécutif

Le chemin réel `loadMiOrgInsights` → agrégats P2.1–P2.6 → `deriveBomayeSignalsFromCrm` / briefing → chat & cockpit **existe dans le code** et est exercé par **163 tests** unitaires / routes (PASS).

Le copilote sait effectivement mesurer et recommander à partir de :

| Famille | Source | Statut intégration |
|---|---|---|
| Activité CA / visites / opportunités | dashboard + MI trends/opps | **branché** |
| Fidélisation / récence (P2.5) | clients + `client_visits` | **branché** (briefing + bridge + prompt) |
| Mix livraison (P2.3) | `order_type` | **branché** |
| Avis (P2.4) | `reviews` | **branché** |
| Campagnes (P2.6) | `campaigns` / `campaign_sends` | **branché** (faits, pas ROI) |
| Bomaye | bridge + advisor | **branché** (chat knowledge + briefing) |

**Ce qui n’est pas entièrement validé :**

1. **UI cockpit** : pas de panneaux dédiés pour `channelMix` / `reviewsInsight` / `recencyLoyalty` / `campaignActivity` — exposition surtout via **briefing** (max **6** items affichés).
2. **Plafonds d’échantillon** (200 avis, 100 campagnes, 500 envois, 2000 visites) : partiellement documentés ; le plafond avis **n’est pas toujours explicité** quand l’échantillon est saturé.
3. **Validation UI authentifiée navigateur** : **non réalisée** → ne pas traiter comme PASS UI.
4. **Aucun test de scénario combiné** (CA↓ + livraison↑ + avis↓ + pending) dédié.

---

## 2. Cartographie du flux réel

```
[Session org + analytics:read]
        │
        ├─ GET /api/mi/insights ──────────┐
        ├─ page /marketing-intelligence ──┤
        └─ POST /api/mi/chat → runMiChatTurn
                    │
                    ▼
         loadMiOrgInsights(supabase, organizationId)
                    │
    ┌───────────────┼───────────────────────────────┐
    ▼               ▼                               ▼
 getClientDashboard  listAllClients            listReviews (≤200)
 (order_type, KPIs)  segments / inactive       listVisitStamps (≤2000)
    │               │                          listCampaigns (≤100)
    │               │                          listCampaignSends (≤500)
    ▼               ▼                               ▼
 channelMix     customerIntelligence          reviewsInsight
 trends         retentionStrategies           recencyLoyalty
 opportunities  campaignProposals             campaignActivity
    │               │                               │
    └───────────────┴───────────────────────────────┘
                    │
                    ▼
         buildMiProactiveBriefing(snapshot)
           ├─ trendFactItems
           ├─ reviewFactItems (P2.4)
           ├─ recencyFactItems (P2.5)
           ├─ campaignActivityFactItems (P2.6)
           ├─ opportunities / retention (dédup familyKey)
           └─ Bomaye: deriveBomayeSignalsFromCrm → evaluateBomayeAdvisor
                    │
                    ▼
         miInsightsForPrompt(insights)  ← inclut channelMix, reviews, récence, campagnes, briefing
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
 formatMiInsights            runMiChatTurn (intent knowledge)
 (cockpit : briefing         derive + merge declared/observed
  + KPIs/trends/opp          → evaluateBomayeAdvisor → LLM
  — PAS de panels dédiés
    P2.3–P2.6 bruts)
```

**Preuves de liens (pas de fonctions orphelines) :**

| Étape | Fichier | Preuve |
|---|---|---|
| Snapshot | `packages/domain-crm/src/mi-tools.ts` | `loadMiOrgInsights` pose `channelMix`, `reviewsInsight`, `recencyLoyalty`, `campaignActivity`, puis `buildMiProactiveBriefing` |
| Prompt | `miInsightsForPrompt` | expose les 4 agrégats + `proactiveBriefing` |
| Bridge chat | `apps/web/lib/mi/run-turn.ts` | intent `knowledge` → `deriveBomayeSignalsFromCrm` → `mergeBomayeSignalSources` → `evaluateBomayeAdvisor` |
| API insights | `apps/web/app/api/mi/insights/route.ts` | `loadMiOrgInsights` + check `organizationId` |
| API chat | `apps/web/app/api/mi/chat/route.ts` | `runMiChatTurn`, orgId session |
| Page SSR | `apps/web/app/(dashboard)/marketing-intelligence/page.tsx` | même snapshot |
| Cockpit | `apps/web/components/mi/mi-cockpit.tsx` | `formatted.proactiveBriefing` (slice 0..6) |

---

## 3. Matrice des six phases et preuves

| Phase | Objectif | Intégré dans snapshot | Bridge Bomaye | Briefing | Chat | Cockpit UI dédié | Verdict phase |
|---|---|---|---|---|---|---|---|
| **P2.1** | Pont CRM → Bomaye (CA, visites, contacts) | oui (trends + clientCount) | `revenueChangePct`, `visitsChangePct`, `hasCrmOrLoyalty` | via Bomaye fires | knowledge path | via briefing / trends | **PASS** |
| **P2.2** | Briefing unifié | `proactiveBriefing` | via items Bomaye | oui | payload insights | oui (section briefing) | **PASS** |
| **P2.3** | Part livraison | `channelMix` | `deliverySharePct` | via Bomaye REGLE-DEC-01 | oui si knowledge | **non** (pas de panel mix) | **PASS WITH LIMITATIONS** |
| **P2.4** | Avis | `reviewsInsight` | `avgReviewScore`, `reviewTrendDown` | famille `reviews_quality` | oui | **non** (via briefing) | **PASS WITH LIMITATIONS** |
| **P2.5** | Récence / fidélisation | `recencyLoyalty` | `repeatRate60dPct` | inactive / at_risk / cooling | oui | **non** (via briefing) | **PASS WITH LIMITATIONS** |
| **P2.6** | Campagnes | `campaignActivity` | faits seulement (pas de signal ROI) | `campaign_activity` | faits dans bridge | **non** (via briefing) | **PASS WITH LIMITATIONS** |

---

## 4. Anomalies classées par gravité

### HIGH
*Aucune anomalie HIGH bloquant la cohérence métier des formules documentées.*

### MEDIUM

| ID | Problème | Impact | Preuve | Correctif recommandé (non appliqué) |
|---|---|---|---|---|
| **A1** | Cockpit n’affiche pas les agrégats bruts P2.3–P2.6 | L’utilisateur voit surtout le briefing (≤6 items) ; le détail livraison/avis/récence/campagnes peut être masqué | `format-insights.ts` ne parse pas `channelMix` / `reviewsInsight` / `recencyLoyalty` / `campaignActivity` ; cockpit `items.slice(0, 6)` | Étendre `formatMiInsights` + panneaux cockpit ; ou augmenter / paginer le briefing |
| **A2** | Plafond avis 200 non toujours explicite | Si ≥200 avis depuis `previous.start`, moyenne/tendance peuvent être **tronquées** sans flag « sample saturé » systématique | `listReviews(..., { limit: 200 })` ; `computeMiReviewsInsight` n’ajoute pas automatiquement « plafond atteint » quand `sampleSizeLoaded === 200` | Si `sampleSizeLoaded >= limit`, pousser limitation + `truncated: true` dans `reviewsInsight` |
| **A3** | Fenêtres temporelles hétérogènes | Le label « période mois » du cockpit mélange KPIs calendaires et métriques glissantes 60/120 j (récence) | P2.5 : `MI_REPEAT_RATE_WINDOW_DAYS` depuis `now` ; KPIs : `periodMeta` dashboard | Afficher clairement « fenêtre 60 j glissante » vs « période dashboard » dans UI/briefing |
| **A4** | Pas de test scénario combiné | Non-régression croisée (CA↓ + livraison↑ + avis↓ + pending) non prouvée | Suites par phase uniquement | Ajouter un test `buildMiProactiveBriefing` + bridge avec fixture combinée |
| **A5** | Validation UI authentifiée absente | Impossible de déclarer « cockpit PASS » en conditions réelles | Aucun parcours browser auth dans cet audit | Session de test manuelle ou e2e auth sur `/marketing-intelligence` |

### LOW

| ID | Problème | Impact | Preuve | Correctif recommandé |
|---|---|---|---|---|
| **B1** | `toolsUsed` de GET `/api/mi/insights` incomplet | Observabilité : n’indique pas P2.3–P2.6 | Route liste seulement load + trends + opps + briefing | Enrichir `toolsUsed` |
| **B2** | Accumulation de `limits` très longue | Bruit dans le prompt LLM / payload | Concaténation channel + reviews + recency + campaigns | Dédupliquage + cap raisonnable exposé |
| **B3** | Campagnes/envois : plafond signalé seulement si saturé | OK en pratique ; asymétrie vs avis | `mi-campaign-activity.ts` si length ≥ 100/500 | Harmoniser flags `truncated` sur tous les loaders |
| **B4** | Merge famille : interprétations concaténées | Textes parfois verbeux après fusion opp+rétention+Bomaye | `mergeIntoFamily` | Prioriser le titre Bomaye critique ; garder evidence en set |

### INFO (comportements documentés, pas des bugs)

- **Livraison** : CA sans `order_type` au dénominateur → part **sous-estimée** possible (limitation écrite).
- **sent** campagne ≠ delivery/lecture WhatsApp (limitation écrite).
- **Inactif ≠ perdu** (P2.5).
- **Pas de ROI / Food Cost / marge / opens / NLP thèmes** — refus explicite.
- Fusion déclaré vs observé : **observed_crm gagne** (`mergeBomayeSignalSources`).

---

## 5. Couverture des limites et plafonds

| Ressource | Plafond code | Flag truncation explicite | Exposé UI |
|---|---|---|---|
| Avis | 200 | **Partiel** (pas auto si saturé) | Via `limits` / briefing missing |
| Visites loyauté | 2000 | Oui si ≥2000 | Via limits |
| Campagnes | 100 | Oui si ≥100 | Via limits |
| Envois | 500 | Oui si ≥500 | Via limits |
| Briefing items UI | 6 | Truncation silencieuse visuelle | **Oui (risque A1)** |
| Missing list UI | 6 | Truncation visuelle | Oui |

**Dénominateurs vérifiés (lecture code, non « corrigés ») :**

| Mesure | Formule | Null si |
|---|---|---|
| `deliverySharePct` | CA livraison / CA période | CA=0 ou aucun `order_type` |
| `averageRating` | Σ notes valides / ratedCount | ratedCount=0 |
| Review trend | Δ ≥ 0.5 et n≥3 / fenêtre | sinon null |
| `repeatRate60dPct` | visit_windows ou proxy ; cohort ≥5 | sinon null |
| `markedSentRatePct` | sent/(sent+failed) ; n≥5 | sinon null |

---

## 6. Résultats des tests

**Commande exécutée (observée) :**

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
  apps/web/lib/mi \
  apps/web/tests/mi-insights-route.test.ts \
  apps/web/tests/mi-cockpit-p1.test.ts
```

**Résultat observé :**  
`Test Files  19 passed (19)` · `Tests  163 passed (163)` · exit code **0**

Couverture : P2.1–P2.6 + Bomaye pack + bridge + briefing + run-turn MI web + route insights + smoke cockpit source.

**Non couvert par ces tests :** scénario combiné multi-signaux ; e2e browser authentifié ; charge réelle > plafonds en prod.

---

## 7. Blocages de validation UI / environnement

| Blocage | Détail |
|---|---|
| **Auth navigateur** | Aucune session utilisateur réelle utilisée dans cet audit → **UI runtime non validée** |
| **Données prod** | Interdit (règle locale) — pas de lecture org réelle |
| **WhatsApp / envois** | Volontairement non exercés |
| **mi-cockpit-p1.test.ts** | Tests source / structure — **≠** PASS UI authentifié |

---

## 8. Correctifs proposés (non appliqués)

1. **A1** — Afficher dans le cockpit des cartes compactes : mix canaux, avis, récence, campagnes (données déjà dans `miInsightsForPrompt`).
2. **A1** — Remplacer `slice(0, 6)` par liste scrollable ou « voir plus ».
3. **A2** — `truncated: boolean` + limitation automatique si `sampleSizeLoaded >= limit` (avis, et harmoniser les autres).
4. **A3** — Libellés UI distincts période dashboard vs fenêtres glissantes 60 j.
5. **A4** — Test transversal fixture combinée (briefing + bridge + formatMiInsights).
6. **A5** — Checklist manuelle auth ou Playwright sur `/marketing-intelligence`.
7. **B1** — Enrichir `toolsUsed` API insights.
8. **B2** — Dédupliquer / plafonner `limits` avant prompt.

---

## 9. Verdict global

### **PASS WITH LIMITATIONS**

**Justification :**

- Le **pipeline code** P2.1→P2.6 est connecté de bout en bout (snapshot → Bomaye → briefing → API/chat/page).
- Les **formules** respectent les garde-fous « null plutôt que 0 inventé », provenance `observed_crm`, pas de ROI/Food Cost inventés.
- Les **163 tests** ciblés passent.
- Les **limitations** portent sur l’**exposition UI** (briefing tronqué, pas de panels bruts), les **plafonds d’échantillon** (surtout avis), l’**hétérogénéité des fenêtres temporelles**, et l’**absence de validation UI authentifiée**.

**Ne pas affirmer :** « les six phases sont entièrement validées en production / UI » — ce serait excessif au regard de A1–A5.

---

*Fin du rapport — aucun code produit modifié dans le cadre de cet audit.*
