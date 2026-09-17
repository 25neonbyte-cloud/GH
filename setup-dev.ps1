$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'backend/.env')) { Copy-Item 'backend/.env.example' 'backend/.env'; Write-Host 'Criado backend/.env. Edite JWT_SECRET e TV_PASSWORD antes do uso real.' }
docker compose up --build
