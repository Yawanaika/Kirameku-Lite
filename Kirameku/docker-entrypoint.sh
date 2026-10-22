#!/bin/sh
# Runs inside the production image before the app starts.
#
# Set RUN_MIGRATIONS=0 for one-off maintenance commands that must not touch the
# database before they run (for example `pnpm db:restore`).
set -eu

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[entrypoint] applying SQLite migrations"
  pnpm db:migrate
fi

exec "$@"
