# Applique les migrations 016+017 — une seule procedure, depuis le bon dossier.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ' LOYALA AI - Synchronisation schema Supabase' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

$tokenPath = Join-Path $env:USERPROFILE '.supabase\access-token'
$localToken = Join-Path $PSScriptRoot '..\.supabase-token.local'
$hasToken = (Test-Path $tokenPath) -or (Test-Path $localToken)

if (-not $hasToken) {
  Write-Host 'Etape 1/2 — Token Supabase requis' -ForegroundColor Yellow
  Write-Host ''
  Write-Host '1. Ouvrez dans votre navigateur :' -ForegroundColor White
  Write-Host '   https://supabase.com/dashboard/account/tokens' -ForegroundColor Green
  Write-Host ''
  Write-Host '2. Cliquez "Generate new token" (nom: loyala-migrate)' -ForegroundColor White
  Write-Host ''
  Write-Host '3. Collez le token ci-dessous (commence par sbp_)' -ForegroundColor White
  Write-Host '   Le token reste LOCAL, il n est pas envoye au chat.' -ForegroundColor DarkGray
  Write-Host ''
  $token = Read-Host 'Token Supabase (sbp_...)'
  if (-not $token -or -not $token.StartsWith('sbp_')) {
    Write-Host 'Token invalide. Relancez le script.' -ForegroundColor Red
    exit 1
  }
  Write-Host ''
  Write-Host 'Connexion + sauvegarde locale du token...' -ForegroundColor Cyan
  $env:SUPABASE_ACCESS_TOKEN = $token
  Set-Content -Path (Join-Path $PSScriptRoot '..\.supabase-token.local') -Value "SUPABASE_ACCESS_TOKEN=$token" -NoNewline
  npx supabase login --token $token --output-format text --agent no 2>$null
  Write-Host 'OK — token enregistre localement.' -ForegroundColor Green
} else {
  if (Test-Path $localToken) {
    Write-Host 'Token local trouve — etape 1 ignoree.' -ForegroundColor Green
    $line = Get-Content $localToken -Raw
    if ($line -match 'SUPABASE_ACCESS_TOKEN=(.+)') { $env:SUPABASE_ACCESS_TOKEN = $matches[1].Trim() }
  } elseif (Test-Path $tokenPath) {
    Write-Host 'Token CLI deja present — etape 1 ignoree.' -ForegroundColor Green
    $env:SUPABASE_ACCESS_TOKEN = Get-Content $tokenPath -Raw
  }
}

Write-Host ''
Write-Host 'Etape 2/2 — Application migrations 016 + 017...' -ForegroundColor Yellow
Write-Host ''

npm run db:sync-crm
$code = $LASTEXITCODE

Write-Host ''
if ($code -eq 0) {
  Write-Host 'SUCCES — schema synchronise. Repondez "fait" dans Cursor.' -ForegroundColor Green
} else {
  Write-Host "ECHEC (code $code). Copiez la sortie d erreur ci-dessus." -ForegroundColor Red
}
exit $code
