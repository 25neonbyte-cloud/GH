#!/usr/bin/env sh
set -eu
[ -f backend/.env ] || cp backend/.env.example backend/.env
echo "Revise backend/.env (JWT_SECRET e TV_PASSWORD) antes do uso real."
docker compose up --build
