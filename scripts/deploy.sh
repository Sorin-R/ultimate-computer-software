#!/usr/bin/env bash
#
# Remote deploy script — executed ON the VPS via `ssh vps 'bash -s' < scripts/deploy.sh`
# from the GitHub Actions workflow (.github/workflows/deploy.yml).
#
# Idempotent and safe to re-run: the CI retries the whole SSH invocation on
# transient connection failures, so every step here must tolerate re-execution
# (git reset is deterministic; `prisma migrate deploy` only applies pending
# migrations; docker build/up converge to the same state).
set -euo pipefail

REPO_DIR="/root/Documents/project/ultimate-computer-software"
DEPLOY_DIR="/opt/ultimate-computer-software"
COMPOSE=(docker compose -f docker-compose.production.yml --env-file .env.production)

# ---- Pull latest from GitHub ----
cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

# ---- Sync source to /opt (Docker build context) ----
cp -r frontend "$DEPLOY_DIR/"
cp -r backend "$DEPLOY_DIR/"

# ---- Build & deploy ----
cd "$DEPLOY_DIR"
"${COMPOSE[@]}" build web
"${COMPOSE[@]}" up -d postgres
# -T + </dev/null: this script is piped to bash over SSH stdin; without them
# `docker compose run` attaches stdin and swallows the rest of the script,
# so bash hits EOF after this line and the web container never restarts.
"${COMPOSE[@]}" run --rm -T --no-deps web npx prisma migrate deploy </dev/null
"${COMPOSE[@]}" up -d web
docker image prune -f

# ---- Health check ----
sleep 5
web_ip=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ucs-web)
if ! curl -fsS "http://${web_ip}:4000/api/health" >/dev/null; then
  echo "❌ Health check failed — recent container logs:" >&2
  docker logs --tail=120 ucs-web >&2
  exit 1
fi

echo "✅ Deploy complete"
