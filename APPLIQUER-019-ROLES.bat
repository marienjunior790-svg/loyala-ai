@echo off
cd /d "%~dp0"
title Loyala AI - Migration 019 roles (sans SQL Editor)
echo.
echo ============================================
echo   Migration 019 - roles Owner (sans navigateur)
echo ============================================
echo.
echo Si le SQL Editor Supabase plante, ce script applique
echo la migration via l API Supabase depuis PowerShell.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\apply-019-roles.ps1"
pause
