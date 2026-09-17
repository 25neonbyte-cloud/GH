@echo off
setlocal
cd /d "%~dp0"
title Hospital PRJT - Parar MVP

echo ===============================================
echo   HOSPITAL PRJT - PARAR MVP
echo ===============================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Docker nao foi encontrado neste computador.
  pause
  exit /b 1
)

echo Encerrando frontend, backend e banco...
docker compose down
if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel encerrar o ambiente corretamente.
  pause
  exit /b 1
)

echo.
echo MVP encerrado. Os dados do PostgreSQL foram preservados no volume Docker.
pause
