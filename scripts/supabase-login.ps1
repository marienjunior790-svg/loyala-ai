# Connexion Supabase CLI — force le mode interactif (évite NonInteractiveError / JSON).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/supabase-login.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

Write-Host 'Connexion Supabase (mode interactif)...' -ForegroundColor Cyan
Write-Host 'Si le navigateur ne s''ouvre pas, copiez le lien affiché.' -ForegroundColor DarkGray

npx supabase login --output-format text --agent no

if (Test-Path "$env:USERPROFILE\.supabase\access-token") {
  Write-Host 'OK — token enregistre. Lancez: npm run db:sync-crm' -ForegroundColor Green
} else {
  Write-Host 'Token absent. Essayez avec un token manuel:' -ForegroundColor Yellow
  Write-Host '  Supabase Dashboard -> Account -> Access Tokens -> Generate' -ForegroundColor DarkGray
  Write-Host '  npx supabase login --token VOTRE_TOKEN --output-format text --agent no' -ForegroundColor DarkGray
  exit 1
}
