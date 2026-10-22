#!/usr/bin/env bash
#
# Daily maintenance for the deployed stack. Run by the kirameku-maintenance
# systemd timer (installed by scripts/deploy-server.sh, see DEPLOY_NOTES.md),
# or by hand:
#
#   cd /home/ubuntu/services/Kirameku-Lite
#   bash scripts/maintenance.sh
#
# It does three things, in this order:
#   1. a fresh SQLite + uploads backup, with retention pruning;
#   2. visitor IP retention (db:prune-visitors, honours VISITOR_RETENTION_DAYS);
#   3. denormalised counter reconciliation (db:reconcile-counts).
#
# Every command runs through `docker compose exec -T` with </dev/null: the
# containers inherit stdin otherwise, which makes cron/systemd runs hang.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
COMPOSE_FILES="${COMPOSE_FILE:-docker-compose.yml}"
APP_SERVICE="${APP_SERVICE:-app}"
LOG_DIR="${MAINTENANCE_LOG_DIR:-$DEPLOY_PATH/logs}"
LOG_FILE="$LOG_DIR/maintenance.log"
LOG_MAX_BYTES="${MAINTENANCE_LOG_MAX_BYTES:-5242880}"

cd "$DEPLOY_PATH"

log() { printf '%s [maintenance] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

mkdir -p "$LOG_DIR"
# Keep a single flat log without pulling in logrotate: drop the file once it
# grows past the cap. Maintenance output is small, so history rarely matters.
if [ -f "$LOG_FILE" ]; then
  size="$(wc -c <"$LOG_FILE" | tr -d ' ')"
  if [ "$size" -gt "$LOG_MAX_BYTES" ]; then
    mv -f "$LOG_FILE" "$LOG_FILE.1"
  fi
fi

# Serialise manual runs against the timer; a second concurrent run exits 0
# instead of fighting over the SQLite backup.
LOCK_FILE="$LOG_DIR/.maintenance.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another maintenance run is in progress, skipping"
  exit 0
fi

exec >>"$LOG_FILE" 2>&1

compose() {
  local args=()
  for file in $COMPOSE_FILES; do args+=(-f "$file"); done
  docker compose "${args[@]}" "$@"
}

run_app() {
  local description="$1"
  shift
  log "$description"
  if compose exec -T "$APP_SERVICE" pnpm "$@" </dev/null; then
    log "$description: ok"
  else
    log "$description: FAILED"
    return 1
  fi
}

[ -f .env ] || fail "missing .env in $DEPLOY_PATH"
compose ps -q "$APP_SERVICE" | grep -q . || fail "$APP_SERVICE container is not running"

log "starting (deploy path: $DEPLOY_PATH)"
status=0

run_app "backup (db + uploads, prune)" db:backup --prune || status=1
run_app "prune visitors" db:prune-visitors || status=1
run_app "reconcile counters" db:reconcile-counts || status=1

if [ "$status" -ne 0 ]; then
  log "finished with errors"
  exit 1
fi

log "finished"
