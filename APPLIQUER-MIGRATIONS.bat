@echo off
cd /d "%~dp0"
title Loyala AI - Appliquer migrations Supabase
echo.
echo ============================================
echo   LOYALA AI - Synchronisation schema Supabase
echo ============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\apply-migrations-interactive.ps1"
pause
