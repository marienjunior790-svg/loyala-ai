# Railway — variables worker (Production)

Copier depuis Supabase / Vercel / Inngest / OpenAI.

```bash
# Obligatoires (worker ne démarre pas sans)
railway variables set NODE_ENV=production
railway variables set NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
railway variables set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
railway variables set WORKER_API_SECRET="openssl rand -hex 32"   # min 16 chars — même valeur sur Vercel
railway variables set OPENAI_API_KEY="sk-..."
railway variables set INNGEST_EVENT_KEY="..."
railway variables set INNGEST_SIGNING_KEY="..."

# Optionnel
railway variables set ANTHROPIC_API_KEY="sk-ant-..."
railway variables set AI_ALLOW_MOCK=false
railway variables set BETTERSTACK_HEARTBEAT_URL="https://..."
```

**Note :** Railway injecte `PORT` automatiquement — le worker écoute `process.env.PORT ?? WORKER_PORT`.

Après déploiement, ajouter sur **Vercel** :
```
WORKER_URL=https://YOUR-SERVICE.up.railway.app
WORKER_API_SECRET=<identique Railway>
```
