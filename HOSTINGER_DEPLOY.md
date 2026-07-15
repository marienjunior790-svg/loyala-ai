# Déploiement Hostinger — Loyala AI Web

Application Next.js 15 autonome, préparée pour **Hostinger Node.js Web Apps**.
Le worker IA (Railway) et Supabase restent des services externes.

## Version Node

```
Node.js >= 20 (recommandé : 20 LTS)
```

## Root Directory

```
/
```

(Racine de l'archive `hostinger-export.zip` — contenu extrait directement à la racine.)

## Commande Install

```bash
npm install
```

Alternative :

```bash
pnpm install
```

> Hostinger exécute cette commande à l'import. Aucun `workspace:*` — compatible npm natif.

## Commande Build

```bash
npm run build
```

> Si vous importez l'archive **déjà buildée** (avec `.next/` présent), Hostinger peut utiliser une build no-op :
> `echo "pre-built"`

## Commande Start

```bash
npm start
```

Équivalent direct :

```bash
node server.js
```

Hostinger injecte automatiquement `PORT` — le serveur écoute sur `0.0.0.0`.

## Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Oui** | URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Oui** | Clé anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Oui** | Service role JWT (server only) |
| `NEXT_PUBLIC_APP_URL` | Recommandé | URL publique de l'app |
| `WORKER_URL` | Recommandé | URL worker Railway |
| `WORKER_API_SECRET` | Recommandé | Secret partagé web ↔ worker (min 16 car.) |
| `RESEND_API_KEY` | Optionnel | Emails transactionnels |
| `UPSTASH_REDIS_REST_URL` | Optionnel | Rate limiting distribué |
| `UPSTASH_REDIS_REST_TOKEN` | Optionnel | Token Upstash |
| `PORT` | Auto | Injecté par Hostinger |
| `NODE_ENV` | Oui | `production` |

Voir `.env.example` pour la liste complète.

## Structure des fichiers

```
hostinger-export/
├── package.json          # Dépendances npm (sans workspace:*)
├── server.js             # Point d'entrée production
├── .env.example            # Template variables
├── next.config.ts          # output: "standalone"
├── tsconfig.json
├── middleware.ts           # Auth session Supabase
├── app/                    # App Router (pages, API, Server Actions)
├── components/
├── lib/
├── public/
├── packages/               # @loyala/* vendored (file:./packages/*)
│   ├── core-iam/
│   ├── db/
│   ├── domain-crm/
│   ├── events/
│   ├── integrations/
│   ├── ui/
│   └── validation/
├── scripts/
│   └── postbuild-standalone.mjs
├── .next/                  # Build Next.js (+ standalone/node_modules)
└── node_modules/           # Après `npm install` (non inclus dans le zip)
```

> L'archive `hostinger-export.zip` **n'inclut pas** `node_modules/` à la racine (taille).
> Hostinger exécute `npm install` à l'import. Les dépendances runtime standalone sont dans `.next/standalone/node_modules/`.

## Import sur Hostinger

1. Générer l'archive : `pnpm hostinger:export` (depuis le monorepo)
2. Uploader **hostinger-export.zip** (format .zip accepté)
3. Configurer les variables d'environnement dans le panneau Hostinger
4. Install : `npm install` | Build : `npm run build` | Start : `npm start`
5. Pointer le domaine personnalisé vers l'application Node.js

## Services externes (non inclus dans l'archive)

| Service | Rôle |
|---------|------|
| **Supabase** | Auth, base de données, storage |
| **Railway Worker** | IA, Inngest, génération campagnes |
| **Resend** | Emails (optionnel) |
| **Upstash** | Rate limiting (optionnel) |

## Notes

- Aucune dépendance `workspace:*` — compatible `npm install` natif.
- Turborepo n'est **pas** requis pour ce déploiement.
- Fonctionnalités conservées : Auth, CRM, Campagnes, IA (via worker), Dashboard, Middleware, Server Actions, API Routes.
