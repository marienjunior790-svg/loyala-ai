@echo off
cd /d "%~dp0"
title Loyala AI - SQL Editor (methode simple)
echo.
echo ============================================
echo   METHODE SIMPLE - SQL Editor Supabase
echo ============================================
echo.
echo NE TAPEZ PAS les lignes "OK ..." ou "missing" dans PowerShell.
echo Ce sont des MESSAGES de succes, pas des commandes.
echo.
echo ETAPES :
echo.
echo  1. Le fichier SQL va s ouvrir dans le Bloc-notes
echo  2. Le navigateur va ouvrir le SQL Editor Supabase
echo  3. Copiez TOUT le contenu du Bloc-notes (Ctrl+A, Ctrl+C)
echo  4. Collez dans le SQL Editor (Ctrl+V)
echo  5. Cliquez RUN (ou Ctrl+Enter)
echo  6. Attendez "Success"
echo.
echo Fichier : supabase\migrations\020_production_full_schema_alignment.sql
echo URL     : https://supabase.com/dashboard/project/nimjmyiggqgvledgwffv/sql/new
echo.
pause
start notepad "%~dp0supabase\migrations\020_production_full_schema_alignment.sql"
start https://supabase.com/dashboard/project/nimjmyiggqgvledgwffv/sql/new
echo.
echo Apres RUN reussi dans Supabase, revenez ici et appuyez sur une touche
echo pour verifier le schema production...
pause
npx @railway/cli run --service loyala-worker node scripts/probe-member-roles.mjs
echo.
if %ERRORLEVEL%==0 (
  echo SUCCES - roles membres OK. Deconnectez-vous puis reconnectez-vous sur le site.
) else (
  echo ATTENTION - verifiez que RUN a affiche Success dans Supabase SQL Editor.
  echo Puis deconnectez-vous / reconnectez-vous sur https://loyala-ai-web.vercel.app
)
pause
