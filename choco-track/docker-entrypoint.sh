#!/bin/sh
# Container entrypoint: keep the SQLite session database on the mounted /data volume, migrate, start.
set -eu

DATA_DIR="${DATA_DIR:-/data}"
if [ ! -w "$DATA_DIR" ]; then
  echo "error: $DATA_DIR is not writable by uid $(id -u); fix the host directory's ownership" >&2
  exit 1
fi

# prisma/schema.prisma points at file:dev.sqlite (relative to prisma/); the image links it to
# /data/sessions.sqlite at build time. Only relink if DATA_DIR was overridden (needs a writable /app).
if [ "$(readlink prisma/dev.sqlite 2>/dev/null)" != "$DATA_DIR/sessions.sqlite" ]; then
  ln -sf "$DATA_DIR/sessions.sqlite" prisma/dev.sqlite
fi

# Session tokens live in this database: keep new files private to the app user.
umask 077

npx prisma migrate deploy
exec npm run start
