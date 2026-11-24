#!/usr/bin/env bash
# Forced command for the CI deploy key (authorized_keys: restrict,command="/usr/local/lib/chocotrack/ci-entry.sh" ssh-ed25519 ...).
# The key can do exactly one thing: deploy an image by git sha and digest. No shell, no file transfer, no forwarding.
set -euo pipefail

cmd="${SSH_ORIGINAL_COMMAND:-}"
if [[ "$cmd" =~ ^deploy\ ([0-9a-f]{40})\ (sha256:[0-9a-f]{64})$ ]]; then
  exec /usr/local/lib/chocotrack/deploy.sh "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
fi

echo "denied: this key may only run: deploy <40-hex-sha> <sha256:digest>" >&2
exit 126
