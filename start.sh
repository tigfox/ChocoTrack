#!/usr/bin/env bash
# Starts the ChocoTrack DEV server for local testing in the dev store.
#
#   ./start.sh          start the dev app (Ctrl+C to stop; the dev preview is cleaned up on exit)
#   ./start.sh check    only check the setup, start nothing
#   ./start.sh clean    remove a leftover dev preview (the dev app then shows https://example.com again)
#
# Why this script exists: a plain `shopify app dev` uses the config the CLI used last, which can be
# ChocoTrack Production. That re-points the production app at a temporary tunnel until undone. This script
# always names the dev config, refuses to run if that config is not the dev app, and never touches production.
# Production only ever gets tested, reviewed code (deployed from main), never anything run from here.
#
# Settings (environment): STORE=<dev store>.myshopify.com, KEEP_PREVIEW=1 to skip the cleanup on exit.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT/choco-track"
CONFIG="shopify.app.toml"
DEV_CLIENT_ID="2ef0375b807cc44d5c647068e8468e9a"
PROD_CLIENT_ID="5f99bca8fb01ba7fb7bf235212689df5"
STORE="${STORE:-creeklakeconfections.myshopify.com}"

say() { printf '%s\n' "$*"; }
die() { printf 'start.sh: %s\n' "$*" >&2; exit 1; }

command -v shopify >/dev/null 2>&1 || die "the Shopify CLI is not installed (see the README: Run the app)."
[ -d "$APP_DIR" ] || die "cannot find $APP_DIR."
[ -f "$APP_DIR/$CONFIG" ] || die "cannot find $APP_DIR/$CONFIG."

# The config must be the dev app, never production.
client_id="$(sed -n 's/^client_id *= *"\([0-9a-f]*\)".*/\1/p' "$APP_DIR/$CONFIG" | head -n 1)"
[ "$client_id" != "$PROD_CLIENT_ID" ] || die "$CONFIG is the PRODUCTION app. Refusing to run."
[ "$client_id" = "$DEV_CLIENT_ID" ] || die "$CONFIG has client_id '$client_id', not the dev app ($DEV_CLIENT_ID). Refusing to run."
case "$STORE" in
  *.myshopify.com) ;;
  *) die "STORE must be a .myshopify.com domain (got '$STORE')." ;;
esac

clean_preview() {
  say "Cleaning up the dev preview on $STORE ..."
  (cd "$APP_DIR" && shopify app dev clean --config "$CONFIG" --store "$STORE") || say "Cleanup failed. Run ./start.sh clean."
}

case "${1:-}" in
  check)
    say "OK: dev app $DEV_CLIENT_ID ($CONFIG), store $STORE. Nothing started."
    exit 0
    ;;
  clean)
    clean_preview
    exit 0
    ;;
  "") ;;
  *) die "unknown command '$1'. Use: ./start.sh | check | clean." ;;
esac

[ -d "$APP_DIR/node_modules" ] || { say "Installing dependencies ..."; (cd "$APP_DIR" && npm install); }

say "Starting the DEV app (not production) on $STORE."
say "Open it in the store admin as 'ChocoTrack' (not 'ChocoTrack Production'). Press Ctrl+C to stop."
if [ "${KEEP_PREVIEW:-}" != "1" ]; then
  trap clean_preview EXIT
fi

cd "$APP_DIR"
shopify app dev --config "$CONFIG" --store "$STORE"
