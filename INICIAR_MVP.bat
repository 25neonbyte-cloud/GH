@echo off
setlocal
cd /d "%~dp0"
title Hospital PRJT - Inicializador do MVP

echo ===============================================
echo   HOSPITAL PRJT - INICIAR MVP
echo ===============================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Docker nao foi encontrado neste computador.
  echo Instale o Docker Desktop e execute este arquivo novamente.
  echo https://www.docker.com/products/docker-desktop/
  echo.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Docker Desktop esta instalado, mas nao esta em execucao.
  echo Abra o Docker Desktop, aguarde ele iniciar e tente novamente.
  echo.
  pause
  exit /b 1
)

if not exist "backend\.env" (
  echo [1/4] Criando configuracao local...
  copy /Y "backend\.env.example" "backend\.env" >nul
) else (
  echo [1/4] Configuracao local encontrada.
)

echo [2/4] Construindo e iniciando banco, backend e frontend...
docker compose up --build -d
if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel iniciar os containers.
  docker compose ps
  echo.
  pause
  exit /b 1
)

echo [3/4] Aguardando a API ficar disponivel...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; 1..90 ^| ForEach-Object { try { $r=Invoke-WebRequest -UseBasicParsing 'http://localhost:3001/health' -TimeoutSec 2; if($r.StatusCode -eq 200){$ok=$true; break} } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){ exit 1 }"
if errorlevel 1 (
  echo.
  echo [ERRO] Os containers iniciaram, mas a API nao respondeu.
  echo Verifique os logs abaixo:
  docker compose logs --tail=80 backend
  echo.
  pause
  exit /b 1
)

echo [4/4] MVP operacional.
echo.
echo Interface: http://localhost:8080
echo API:       http://localhost:3001
echo Usuario:   admin
echo Senha:     Admin123!
echo.
echo O navegador sera aberto automaticamente.
start "" "http://localhost:8080"
echo.
echo Para desligar o ambiente use PARAR_MVP.bat.
echo Esta janela pode ser fechada.
pause
