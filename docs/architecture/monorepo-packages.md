# Monorepo packages & Turborepo (P3)

## Modèle

Les packages `@loyala/*` sont des **packages source** consommés via :

- Next.js `transpilePackages` (`apps/web/next.config.ts`)
- Worker esbuild bundle (`apps/worker/scripts/bundle.mjs`)

Ils n’ont **pas** d’étape `tsc` → `dist` obligatoire. `turbo typecheck` valide les types ; `turbo build` construit uniquement les apps déployables.

## Tasks Turbo

| Task | Rôle |
|------|------|
| `build` | `web` → Next ; `worker` → bundle `dist/server.mjs` |
| `typecheck` | `tsc --noEmit` partout (`dependsOn: ^typecheck`) |
| `lint` | ESLint flat config racine (plus de placeholders `echo`) |
| `test` | Vitest (racine) |

Le lint ne dépend plus de `^build` (évite des builds inutiles pour du lint).

## Worker

- `pnpm --filter worker build` = bundle déployable (Railway)
- `build:tsc` reste dispo pour diagnostic TypeScript seul
- CI utilise explicitement le bundle déployable

## Ajouter un package

1. Créer `packages/<name>` avec `main`/`types` pointant vers `src/index.ts`
2. Ajouter au workspace + `transpilePackages` / bundle externals si besoin
3. Scripts : `typecheck`, `lint` (eslint), pas de `build` sauf sortie `dist` réelle
