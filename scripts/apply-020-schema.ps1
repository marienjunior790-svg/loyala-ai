# Applique migration 020 + audit schema complet
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host ''
Write-Host 'Migration 020 — alignement schema production complet' -ForegroundColor Cyan
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
  Write-Host 'Token requis: https://supabase.com/dashboard/account/tokens' -ForegroundColor Yellow
  $token = Read-Host 'Collez le token (sbp_...)'
  if (-not $token -or -not $token.StartsWith('sbp_')) { Write-Host 'Token invalide.' -ForegroundColor Red; exit 1 }
  $env:SUPABASE_ACCESS_TOKEN = $token
  Set-Content -Path $localToken -Value "SUPABASE_ACCESS_TOKEN=$token" -NoNewline
}

node scripts/apply-migration-file.mjs 020_production_full_schema_alignment.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Audit schema...' -ForegroundColor Cyan
npx @railway/cli run --service loyala-worker node scripts/audit-prod-schema.mjs
$audit = $LASTEXITCODE

Write-Host ''
Write-Host 'Tests Campagnes...' -ForegroundColor Cyan
npx @railway/cli run --service loyala-worker node scripts/test-campaigns-module.mjs
$tests = $LASTEXITCODE

Write-Host ''
if ($audit -eq 0 -and $tests -eq 0) {
  Write-Host 'SUCCES — schema aligne et tests Campagnes OK' -ForegroundColor Green
} else {
  Write-Host "Audit=$audit Tests=$tests — verifiez la sortie ci-dessus" -ForegroundColor Yellow
}
exit [Math]::Max($audit, $tests)
