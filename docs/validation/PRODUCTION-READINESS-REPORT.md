# Rapport de préparation production — Loyala AI

**Date :** 6 juillet 2026  
**Version :** commit post `a59553c` + optimisations production  
**URL cible :** https://loyala-ai-web.vercel.app

---

## 1. Ce qui a été terminé

### SEO
| Item | Statut | Détail |
|------|--------|--------|
| Metadata enrichie | ✅ | Title template, keywords, canonical, OG |
| `robots.ts` | ✅ | Disallow dashboard/API, allow marketing |
| `sitemap.ts` | ✅ | `/`, `/login`, `/signup` |
| `noindex` CRM | ✅ | Layouts `(dashboard)` et `(auth)` |
| JSON-LD landing | ✅ | `SoftwareApplication` schema |
| Favicon / icon | ✅ | `app/icon.tsx` (PNG dynamique) |
| Web manifest | ✅ | `app/manifest.ts` PWA basique |

### Performances
| Item | Statut | Détail |
|------|--------|--------|
| `compress: true` | ✅ | next.config |
| `optimizePackageImports` | ✅ | lucide-react, radix |
| Font `display: swap` | ✅ | Inter preload |
| Images Supabase | ✅ | `remotePatterns` + avif/webp |
| `poweredByHeader: false` | ✅ | Sécurité + perf |
| Dashboard `force-dynamic` | ✅ | Intentionnel (données auth) |

### Sécurité
| Item | Statut | Détail |
|------|--------|--------|
| Headers HSTS, XFO, nosniff | ✅ | vercel.json |
| Content-Security-Policy | ✅ | vercel.json |
| Open redirect auth callback | ✅ | `safeAuthRedirectPath` |
| Rate limit AI routes | ✅ | Upstash ou in-memory |
| Env fail-fast prod (web) | ✅ | `env-runtime.ts` |
| Messages erreur sanitizés | ✅ | `sanitizeUserErrorMessage` |
| Worker API secret | ✅ | Bearer auth |

### Accessibilité
| Item | Statut | Détail |
|------|--------|--------|
| Skip link | ✅ | Dashboard + landing |
| `#main-content` | ✅ | Landmarks |
| Login form labels | ✅ | `htmlFor` + `autoComplete` |
| Recherche clients | ✅ | `aria-label` |
| Filtres clients | ✅ | `aria-pressed` + `role="group"` |
| Icon buttons nav | ✅ | `aria-label` existants |

### Responsive
| Item | Statut | Détail |
|------|--------|--------|
| Mobile bottom nav | ✅ | Existant |
| Sidebar drawer mobile | ✅ | Existant |
| Grilles adaptatives | ✅ | Tailwind sm/md/lg |

### Monitoring & Logs
| Item | Statut | Détail |
|------|--------|--------|
| Logs JSON structurés | ✅ | `@loyala/integrations` |
| `onRequestError` | ✅ | instrumentation.ts |
| Error boundaries report | ✅ | error.tsx, global-error, dashboard/error |
| Heartbeat Better Stack | ✅ | Web startup + worker |
| Health endpoints | ✅ | `/api/health`, worker `/health` |

### Gestion erreurs
| Item | Statut | Détail |
|------|--------|--------|
| `global-error.tsx` | ✅ | Root layout failures |
| `(dashboard)/error.tsx` | ✅ | Segment dashboard |
| `ModuleError` sanitizé | ✅ | Pas de fuite SQL en prod |
| Clients error boundary | ✅ | Existant |

### CI/CD
| Item | Statut | Détail |
|------|--------|--------|
| CI typecheck + tests + build | ✅ | `.github/workflows/ci.yml` |
| Journey smoke tests | ✅ | 54+ tests incl. prod health |
| CD smoke post-deploy | ✅ | Health ok/degraded |
| Safe redirect tests | ✅ | `safe-redirect.test.ts` |

---

## 2. Fichiers modifiés / ajoutés

### Nouveaux
```
apps/web/app/robots.ts
apps/web/app/sitemap.ts
apps/web/app/icon.tsx
apps/web/app/manifest.ts
apps/web/app/global-error.tsx
apps/web/app/(dashboard)/error.tsx
apps/web/lib/auth/safe-redirect.ts
apps/web/lib/auth/safe-redirect.test.ts
apps/web/lib/errors/sanitize.ts
apps/web/lib/monitoring/error-report.ts
apps/web/components/ui/skip-link.tsx
docs/validation/PRODUCTION-READINESS-REPORT.md
```

### Modifiés
```
apps/web/next.config.ts          — perf, images, bundle
apps/web/vercel.json             — CSP
apps/web/app/layout.tsx          — SEO metadata
apps/web/app/page.tsx            — JSON-LD, skip link
apps/web/app/error.tsx           — error reporting
apps/web/instrumentation.ts      — onRequestError, startup
apps/web/lib/env-runtime.ts      — fail-fast prod
apps/web/app/auth/callback/route.ts — safe redirect
apps/web/app/(dashboard)/layout.tsx — noindex
apps/web/app/(auth)/layout.tsx   — noindex
apps/web/components/dashboard/dashboard-shell.tsx — a11y
apps/web/components/dashboard/module-error.tsx — sanitize
apps/web/app/(auth)/login/login-form.tsx — a11y
apps/web/components/clients/clients-list.tsx — a11y
packages/validation/src/env.ts   — UPSTASH, SENTRY, APP_URL prod
.github/workflows/ci.yml         — APP_URL build, smoke job
.github/workflows/cd.yml           — health body validation
```

---

## 3. Migrations Supabase

| # | Fichier | Statut prod | Contenu |
|---|---------|-------------|---------|
| 001–011 | Core, CRM, RLS, onboarding | ⚠️ Vérifier | Base tenant + clients |
| **012** | `012_platform_modules.sql` | ⚠️ **Requis** | campaigns, loyalty, reviews, notifications |
| **013** | `013_storage_org_assets.sql` | ⚠️ **Requis** | Bucket logo org (Storage) |

**Commande :** Appliquer via Supabase Dashboard → SQL ou `supabase db push`.

---

## 4. Dépendances ajoutées (session précédente)

| Package | Version | Usage |
|---------|---------|-------|
| `@loyala/integrations` | workspace | Email Resend, monitoring, storage |
| `@loyala/domain-crm` | worker dep | Persistance campagnes Inngest |

Aucune nouvelle dépendance npm externe pour cette passe production (pas de Sentry SDK — logs structurés suffisants pour MVP).

---

## 5. Variables d'environnement production

### Vercel (web) — obligatoires
```
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=https://loyala-ai-web.vercel.app
WORKER_URL=
WORKER_API_SECRET=
AI_ALLOW_MOCK=false
OPENAI_API_KEY= (ou ANTHROPIC)
```

### Vercel — recommandées
```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
BETTERSTACK_HEARTBEAT_URL=
SENTRY_DSN= (futur SDK)
```

### Railway (worker) — obligatoires
```
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WORKER_API_SECRET=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
OPENAI_API_KEY=
AI_ALLOW_MOCK=false
```

---

## 6. Risques restants

| Priorité | Risque | Mitigation |
|----------|--------|------------|
| **P0** | Migrations 012/013 non appliquées | Appliquer avant go-live clients |
| **P0** | Rate limit in-memory sans Upstash | Configurer Upstash sur Vercel |
| **P1** | Pas de SDK Sentry | Logs Vercel + Better Stack heartbeat |
| **P1** | WhatsApp = wa.me manuel | Acceptable MVP ; API Meta = phase 2 |
| **P1** | Stripe non intégré | Upgrade manuel WhatsApp |
| **P2** | ESLint/a11y lint non automatisé | Tests manuels + amélioration continue |
| **P2** | Pas d'E2E browser en CI | Smoke tests HTTP + journey unit tests |
| **P2** | CSP `unsafe-inline/eval` | Requis par Next.js — revoir avec nonce plus tard |
| **P3** | Pas d'OG image statique | Ajouter `opengraph-image.tsx` plus tard |

---

## 7. Checklist mise en production

### Supabase
- [ ] Migrations 001–013 appliquées
- [ ] RLS vérifié (`pnpm test:rls` avec secrets CI)
- [ ] Backup automatique activé
- [ ] Auth email templates configurés

### Vercel
- [ ] Toutes les variables env définies
- [ ] `NEXT_PUBLIC_APP_URL` = URL finale
- [ ] Domaine custom configuré (optionnel)
- [ ] Build réussi post-push

### Railway
- [ ] Worker déployé avec nouvelles deps
- [ ] Inngest connecté (`/api/inngest`)
- [ ] Health `/health` = 200

### Sécurité
- [ ] `AI_ALLOW_MOCK=false`
- [ ] `WORKER_API_SECRET` ≥ 16 chars, identique web/worker
- [ ] Upstash Redis configuré
- [ ] Review CSP en staging

### Monitoring
- [ ] Better Stack heartbeat configuré
- [ ] Alertes Vercel/Railway activées
- [ ] Test `/api/health` → `ok` ou `degraded`

### Fonctionnel
- [ ] Parcours signup → onboarding → client → relance WhatsApp
- [ ] Campagne IA génère relances en DB
- [ ] Notifications in-app
- [ ] Cron Inngest 08h UTC (vérifier dashboard Inngest)

### SEO / Marketing
- [ ] `/sitemap.xml` accessible
- [ ] `/robots.txt` accessible
- [ ] Landing indexée, dashboard noindex vérifié (view-source)

### Post-launch
- [ ] Lighthouse mobile ≥ 80 (landing)
- [ ] Surveiller logs 24h
- [ ] Support WhatsApp opérationnel pour upgrades

---

## 8. Commandes de vérification

```bash
pnpm typecheck
pnpm test
pnpm --filter web build

# Production health
curl https://loyala-ai-web.vercel.app/api/health
curl https://<worker-url>/health
```

---

*Rapport généré dans le cadre de la préparation production Loyala AI.*
