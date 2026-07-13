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

# WhatsApp Cloud API (optionnel — false = fallback wa.me)
railway variables set WHATSAPP_API_ENABLED=false
# Quand WHATSAPP_API_ENABLED=true :
# railway variables set WHATSAPP_ACCESS_TOKEN="EAA..."
# railway variables set WHATSAPP_PHONE_NUMBER_ID="123456789"
# railway variables set WHATSAPP_BUSINESS_ACCOUNT_ID="987654321"
# railway variables set WHATSAPP_API_VERSION="v21.0"
# railway variables set WHATSAPP_WEBHOOK_VERIFY_TOKEN="openssl rand -hex 16"
```

**Probe envoi test** (après credentials Meta + template approuvé) :
```bash
curl -X POST "$WORKER_URL/whatsapp/send-test" \
  -H "Authorization: Bearer $WORKER_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"to":"221771234567","templateName":"hello_world","templateLanguage":"fr"}'
```

**Note :** Railway injecte `PORT` automatiquement — le worker écoute `process.env.PORT ?? WORKER_PORT`.

Après déploiement, ajouter sur **Vercel** :
```
WORKER_URL=https://YOUR-SERVICE.up.railway.app
WORKER_API_SECRET=<identique Railway>
```
