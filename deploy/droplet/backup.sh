#!/usr/bin/env bash
# Consistent backup of the SQLite session database; keeps 14 days. Run daily from cron (see README).
# The data is only OAuth sessions, so losing it just means re-opening the app to sign in again.
set -euo pipefail

SRC=/opt/chocotrack/data/sessions.sqlite
DEST=/var/backups/chocotrack
[ -f "$SRC" ] || { echo "no database at $SRC" >&2; exit 1; }

sqlite3 "$SRC" ".backup '$DEST/sessions-$(date +%F).sqlite'"
find "$DEST" -name 'sessions-*.sqlite' -mtime +14 -delete
