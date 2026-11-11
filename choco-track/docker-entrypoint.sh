#!/bin/sh
# Container entrypoint: keep the SQLite session database on the mounted /data volume, migrate, start.
set -eu

DATA_DIR="${DATA_DIR:-/data}"
if [ ! -w "$DATA_DIR" ]; then
  echo "error: $DATA_DIR is not writable by uid $(id -u); fix the host directory's ownership" >&2
  exit 1
fi

# prisma/schema.prisma points at file:dev.sqlite (relative to prisma/); keep the real file on the volume.
ln -sf "$DATA_DIR/sessions.sqlite" prisma/dev.sqlite

npx prisma migrate deploy
exec npm run start
