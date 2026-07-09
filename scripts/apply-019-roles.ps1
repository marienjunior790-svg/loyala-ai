# Applique migration 019 (roles Owner) via Management API — sans SQL Editor.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host ''
Write-Host 'Migration 019 — roles + backfill org_owner' -ForegroundColor Cyan
Write-Host ''

$tokenPath = Join-Path $env:USERPROFILE '.supabase\access-token'
$localToken = Join-Path (Get-Location) '.supabase-token.local'

if (Test-Path $localToken) {
  $line = Get-Content $localToken -Raw
  if ($line -match 'SUPABASE_ACCESS_TOKEN=(.+)') { $env:SUPABASE_ACCESS_TOKEN = $matches[1].Trim() }
} elseif (Test-Path $tokenPath) {
  $env:SUPABASE_ACCESS_TOKEN = (Get-Content $tokenPath -Raw).Trim()
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host 'Token requis (une seule fois) :' -ForegroundColor Yellow
  Write-Host '  https://supabase.com/dashboard/account/tokens' -ForegroundColor Green
  Write-Host ''
  $token = Read-Host 'Collez le token (sbp_...)'
  if (-not $token -or -not $token.StartsWith('sbp_')) {
    Write-Host 'Token invalide.' -ForegroundColor Red
    exit 1
  }
  $env:SUPABASE_ACCESS_TOKEN = $token
  Set-Content -Path $localToken -Value "SUPABASE_ACCESS_TOKEN=$token" -NoNewline
}

node scripts/apply-migration-file.mjs 019_production_go_live_roles.sql
$code = $LASTEXITCODE

Write-Host ''
if ($code -eq 0) {
  Write-Host 'SUCCES — deconnectez-vous puis reconnectez-vous sur le site.' -ForegroundColor Green
} else {
  Write-Host "ECHEC (code $code). Verifiez le token ou utilisez Edge en navigation privee." -ForegroundColor Red
}
exit $code
