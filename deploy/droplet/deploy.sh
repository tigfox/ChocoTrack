#!/usr/bin/env bash
# Pulls an image tag and (re)starts the stack. Usage: ./deploy.sh [tag]   (default: latest)
# Roll back by running it again with an older tag, e.g. ./deploy.sh 3f7f2b9
set -euo pipefail

cd "$(dirname "$0")"
TAG="${1:-latest}"

[ -f .env ] || { echo "missing .env (copy .env.example and fill it in)" >&2; exit 1; }
if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${TAG}|" .env
else
  echo "IMAGE_TAG=${TAG}" >> .env
fi

docker compose pull
docker compose up -d --remove-orphans

# Wait for the app's healthcheck rather than assuming the start worked
for _ in $(seq 1 30); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && { echo "deployed ${TAG}: healthy"; docker image prune -f >/dev/null; exit 0; }
  sleep 4
done

echo "app did not become healthy; recent logs:" >&2
docker compose logs --tail=40 app >&2
exit 1
