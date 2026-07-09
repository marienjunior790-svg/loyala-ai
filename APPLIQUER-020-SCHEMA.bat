@echo off
cd /d "%~dp0"
title Loyala AI - Migration 020 schema complet
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\apply-020-schema.ps1"
pause
