#!/usr/bin/env bash
# Installs the stack files on the Droplet. Run from your laptop as the admin user after reviewing a change
# to anything in deploy/droplet (CI is not allowed to change these files on the host):
#   deploy/droplet/push-stack.sh <admin>@<droplet>
set -euo pipefail

HOST="${1:?usage: push-stack.sh <admin>@<droplet>}"
cd "$(dirname "$0")"

ssh "$HOST" 'rm -rf /tmp/chocotrack-stack && mkdir -m 700 /tmp/chocotrack-stack'
scp -q docker-compose.yml Caddyfile .env.example deploy.sh ci-entry.sh backup.sh "$HOST:/tmp/chocotrack-stack/"
ssh "$HOST" 'set -e
  cd /tmp/chocotrack-stack
  sudo install -d -m 755 -o root -g root /usr/local/lib/chocotrack
  sudo install -m 755 -o root -g root deploy.sh ci-entry.sh backup.sh /usr/local/lib/chocotrack/
  sudo install -m 644 -o root -g root docker-compose.yml Caddyfile .env.example /opt/chocotrack/
  cd /opt/chocotrack && rm -rf /tmp/chocotrack-stack
  sudo -u deploy docker compose config -q && echo "stack files installed and valid"'
