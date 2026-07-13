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
# railway variables set WHATSAPP_APP_SECRET="<Meta App Secret — même valeur que dans Meta Developer>"

# Auto-send Inngest (GO 3) — 1 client pilote uniquement
# railway variables set WHATSAPP_TEST_CLIENT_ID="<uuid-client-supabase>"
# ou railway variables set WHATSAPP_TEST_PHONE="221771234567"
# railway variables set WHATSAPP_CAMPAIGN_TEMPLATE_NAME="hello_world"   # pilote uniquement
# Sans override → catalogue loyala_*_v1 (après approbation Meta + mark-meta-templates-approved)
# railway variables set WHATSAPP_CAMPAIGN_TEMPLATE_LANGUAGE="fr"
```

**Webhook Meta (GO 4)** — callback URL dans Meta Developer :
```
https://YOUR-SERVICE.up.railway.app/whatsapp/webhook
```
Verify token = même valeur que `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
Abonner le champ **messages** (status updates: sent, delivered, read, failed).

**Probe envoi test** (après credentials Meta + template approuvé) :
```bash
curl -X POST "$WORKER_URL/whatsapp/send-test" \
  -H "Authorization: Bearer $WORKER_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"to":"221771234567","templateName":"hello_world","templateLanguage":"fr","organizationId":"<org-uuid>","clientId":"<client-uuid>"}'
```
`organizationId` optionnel — si fourni, écrit dans `whatsapp_messages` pour valider le webhook E2E.

**Note :** Railway injecte `PORT` automatiquement — le worker écoute `process.env.PORT ?? WORKER_PORT`.

**Campagnes planifiées (UI)** — Inngest cron `*/15 * * * *` exécute les campagnes `status=scheduled` dont `scheduled_at` est dépassé (génère les `campaign_sends` → `/relances`).

Après déploiement, ajouter sur **Vercel** :
```
WORKER_URL=https://YOUR-SERVICE.up.railway.app
WORKER_API_SECRET=<identique Railway>
```
