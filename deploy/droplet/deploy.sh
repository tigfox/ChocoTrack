#!/usr/bin/env bash
# Deploys one pinned image. Installed root-owned at /usr/local/lib/chocotrack/deploy.sh and run as the
# deploy user, normally through ci-entry.sh (the CI key's forced command). Never writable by deploy.
#
#   deploy.sh <git-sha> <sha256:image-digest>   deploy that exact image (CI does this)
#   deploy.sh <git-sha>                         roll back to a sha deployed before (digest from releases.log)
#
# Images are referenced by digest, so a re-pushed or tampered registry tag cannot change what runs.
set -euo pipefail

APP_DIR=/opt/chocotrack
IMAGE_REPO=ghcr.io/tigfox/chocotrack
cd "$APP_DIR"

fail() { echo "deploy: $*" >&2; exit 1; }

SHA="${1:-}"
DIGEST="${2:-}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "first argument must be a 40-character git sha"
if [ -z "$DIGEST" ]; then
  DIGEST="$(awk -v s="$SHA" '$2 == s { d = $3 } END { print d }' releases.log 2>/dev/null || true)"
  [ -n "$DIGEST" ] || fail "no digest recorded for $SHA in releases.log; pass it as the second argument"
fi
[[ "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "second argument must look like sha256:<64 hex>"
[ -f .env ] || fail "missing .env (copy .env.example and fill it in)"

PREVIOUS_REF="$(grep '^IMAGE_REF=' .env | cut -d= -f2- || true)"
NEW_REF="${IMAGE_REPO}@${DIGEST}"

set_image() { # rewrite .env atomically with the given image ref and sha, keeping mode 600
  local ref="$1" sha="$2" tmp
  tmp="$(mktemp .env.XXXXXX)"
  grep -vE '^(IMAGE_REF|DEPLOYED_SHA|IMAGE_TAG)=' .env > "$tmp" || true
  printf 'IMAGE_REF=%s\nDEPLOYED_SHA=%s\n' "$ref" "$sha" >> "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" .env
}

wait_healthy() {
  local status
  for _ in $(seq 1 30); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null || echo starting)"
    [ "$status" = "healthy" ] && return 0
    sleep 4
  done
  return 1
}

# Pull first, with the new ref passed in the environment, so a failed pull changes nothing on disk.
IMAGE_REF="$NEW_REF" docker compose pull || fail "could not pull ${NEW_REF}; nothing was changed"

set_image "$NEW_REF" "$SHA"
if docker compose up -d --remove-orphans && wait_healthy; then
  echo "$(date -u +%FT%TZ) $SHA $DIGEST" >> releases.log
  docker image prune -f >/dev/null
  echo "deployed ${SHA} (${DIGEST}): healthy"
  exit 0
fi

echo "new image did not start healthy; recent logs:" >&2
docker compose logs --tail=40 app >&2
if [ -n "$PREVIOUS_REF" ]; then
  echo "rolling back to ${PREVIOUS_REF}" >&2
  set_image "$PREVIOUS_REF" "rolled-back"
  docker compose up -d --remove-orphans
fi
exit 1
