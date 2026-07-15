# Export Loyala AI as .zip for Hostinger Node upload (.zip / .tar.gz / .tgz only)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$staging = Join-Path $env:TEMP "loyala-ai-hostinger-export"
$zipPath = Join-Path $root "loyala-ai-hostinger-export.zip"

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

New-Item -ItemType Directory -Path $staging | Out-Null

$excludeDirs = @('node_modules', '.git', '.next', '.turbo', 'dist', 'coverage', '.vercel')
$excludeFiles = @('*.tsbuildinfo', 'loyala-ai-hostinger-export.zip')

Write-Host "Copie du projet (sans node_modules)..." -ForegroundColor Cyan

robocopy $root $staging /E /XD $excludeDirs /XF $zipPath /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }

Write-Host "Creation du ZIP..." -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -Force

Remove-Item $staging -Recurse -Force

$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "OK: $zipPath ($sizeMb Mo)" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT:" -ForegroundColor Yellow
Write-Host "  - Uploadez CE fichier .zip sur Hostinger (pas un dossier, pas un .sql)" -ForegroundColor White
Write-Host "  - La migration 020 reste a faire dans Supabase SQL Editor, pas sur Hostinger" -ForegroundColor White
Write-Host "  - Loyala est deja sur Vercel + Railway; Hostinger est optionnel" -ForegroundColor White

explorer.exe /select,"$zipPath"
