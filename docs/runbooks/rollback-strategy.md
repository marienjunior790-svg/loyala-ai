# Stratégie de rollback — Loyala AI

Objectif : restaurer un état stable en **< 15 minutes** sans perte de données client.

## Niveaux de rollback

| Niveau | Scope | Durée | Quand |
|--------|-------|-------|-------|
| **L1** | Vercel deployment | 1–2 min | Bug UI/API web, pas de migration DB |
| **L2** | Worker redeploy | 2–5 min | Bug IA, Inngest, routes `/ai/*` |
| **L3** | Migration DB down | 10–30 min | Migration SQL défectueuse |
| **L4** | Restore Supabase | 30–60 min | Corruption données, incident majeur |

---

## L1 — Rollback Vercel (web)

### Instant rollback (recommandé)

1. Vercel Dashboard → **Project → Deployments**
2. Trouver le dernier déploiement **stable** (green)
3. **⋯ → Promote to Production**

### Via CLI

```bash
vercel rollback [deployment-url]
```

### Vérification post-rollback

```bash
curl https://[app-domain]/api/health
# → {"status":"ok","service":"loyala-web",...}
```

---

## L2 — Rollback Worker

### Railway

1. **Deployments** → sélectionner déploiement précédent
2. **Redeploy** ou **Rollback**

### Fly.io

```bash
fly releases list
fly releases rollback
```

### Vérification

```bash
curl https://[worker]/health
curl -H "Authorization: Bearer $WORKER_API_SECRET" \
  -X POST https://[worker]/ai/inbox/classify \
  -d '{"organizationId":"...","text":"test","messageId":"m1"}'
```

---

## L3 — Rollback migration SQL

**Principe** : chaque migration doit avoir un script `down` ou être réversible manuellement.

### Procédure

1. **Stop** les workers (éviter écritures pendant rollback)
2. Identifier la migration fautive dans `_loyala_migrations`
3. Exécuter le SQL inverse dans Supabase SQL Editor (staging d'abord)
4. Supprimer la ligne `_loyala_migrations` correspondante
5. Redéployer code compatible version N-1
6. Redémarrer workers

### Exemple (004 date_of_birth)

```sql
ALTER TABLE clients DROP COLUMN IF EXISTS date_of_birth;
DELETE FROM _loyala_migrations WHERE name = '004_client_date_of_birth.sql';
```

> ⚠️ Ne jamais rollback une migration qui a supprimé des colonnes avec données sans backup.

---

## L4 — Restore Supabase

1. Supabase Dashboard → **Database → Backups**
2. Choisir point-in-time (PITR) ou snapshot daily
3. Restore vers **nouveau projet** staging d'abord
4. Valider intégrité (count orgs, clients, RLS)
5. Basculer `NEXT_PUBLIC_SUPABASE_URL` + clés vers projet restauré
6. Redéployer web + worker

---

## Feature flags (prévention)

Pour les features risquées Sprint 3+ :

- Variable `FEATURE_X_ENABLED=false` → désactiver sans redeploy code
- Inngest : pause function dans dashboard

---

## Communication incident

1. Statut interne (Slack `#incidents`)
2. Message clients si downtime > 15 min
3. Post-mortem sous 48 h (cause, timeline, actions)

---

## Tests rollback (trimestriel)

- [ ] Rollback Vercel staging → health OK
- [ ] Rollback worker staging → `/health` OK
- [ ] Restore backup staging → requêtes RLS OK
