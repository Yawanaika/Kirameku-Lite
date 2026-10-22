#!/usr/bin/env bash
#
# Deploy the published image on the server. Nothing here builds code: it pulls
# the tag, recreates the container, and rolls back if the new container never
# becomes healthy.
#
# Normally executed by .github/workflows/release.yml, which streams this file
# into `bash -s` over SSH together with DEPLOY_PATH / IMAGE_REF / GHCR_*.
# Manual run:
#
#   cd /srv/kirameku
#   IMAGE_REF=ghcr.io/owner/kirameku:latest bash scripts/deploy-server.sh
#
# Environment:
#   DEPLOY_PATH            compose project directory (default: current dir)
#   IMAGE_REF              image tag to deploy; empty keeps docker-compose.yml's default
#   COMPOSE_FILE           compose file(s), space separated (default: docker-compose.yml)
#   SERVICES               services to recreate (default: all services)
#   APP_SERVICE            service to health-check (default: app)
#   HEALTH_TIMEOUT         seconds to wait for `healthy` (default: 180)
#   SHARED_NETWORK         external docker network the app joins so your proxy
#                          can reach it (default: kirameku-edge)
#   BACKUP_BEFORE_DEPLOY   1 = `pnpm db:backup --prune` before recreating (default: 1)
#   APP_UID                UID the app runs as, used to own the bind-mounted data
#                          directories (default: 1000)
#   PRUNE_IMAGES           1 = drop dangling images after a successful deploy (default: 1)
#   MAINTENANCE_TIMER      1 = install/refresh the daily systemd timer that runs
#                          scripts/maintenance.sh (default: 1; skipped when sudo
#                          is not available non-interactively)
#   MAINTENANCE_SCHEDULE   systemd OnCalendar for that timer (default: *-*-* 04:30:00)
#   PULL_GIT               1 = `git pull --ff-only` before deploying (default: 0)
#   GHCR_USER / GHCR_TOKEN optional; when set, docker logs in with a throwaway
#                          config so no expired credential is left behind
set -euo pipefail

log() { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

cd "${DEPLOY_PATH:-$(pwd)}" || fail "cannot enter ${DEPLOY_PATH:-$(pwd)}"
[ -f .env ] || fail "missing .env in $(pwd) (copy compose.env.example and fill it in)"

# COMPOSE_FILE accepts several files, space separated, e.g.
#   COMPOSE_FILE="docker-compose.yml docker-compose.host-proxy.yml"
COMPOSE_FILES="${COMPOSE_FILE:-docker-compose.yml}"
for file in $COMPOSE_FILES; do
  [ -f "$file" ] || fail "missing $file in $(pwd)"
done

if [ "${PULL_GIT:-0}" = "1" ] && [ -d .git ]; then
  log "updating working tree"
  git pull --ff-only
fi

# --- shared proxy network ----------------------------------------------------
# docker-compose.yml attaches the app to an *external* network so an existing
# proxy — typically a Caddy container in another compose project — can reach it
# as kirameku-app:3000. An external network must exist before `compose up`, and
# creating it is idempotent, so do it here rather than making it a manual step.
read_env() {
  # Read KEY from .env (last occurrence wins) so deploy-time switches can live
  # next to the rest of the configuration. Values are unquoted and trimmed.
  sed -n "s/^$1=//p" .env | tail -n1 | tr -d '\r' | sed -e "s/^[\"' ]*//" -e "s/[\"' ]*$//"
}

if [ -z "${SHARED_NETWORK:-}" ] && [ -f .env ]; then
  # Read it from .env so the network created here is the one compose will join.
  SHARED_NETWORK="$(read_env SHARED_NETWORK)"
fi
SHARED_NETWORK="${SHARED_NETWORK:-kirameku-edge}"
export SHARED_NETWORK
if ! docker network inspect "$SHARED_NETWORK" >/dev/null 2>&1; then
  log "creating docker network $SHARED_NETWORK"
  docker network create "$SHARED_NETWORK" >/dev/null
fi

compose() {
  local args=()
  for file in $COMPOSE_FILES; do args+=(-f "$file"); done
  docker compose "${args[@]}" "$@"
}

# --- registry login -----------------------------------------------------------
# Use a throwaway DOCKER_CONFIG so a workflow-scoped GITHUB_TOKEN is never
# persisted in the operator's ~/.docker/config.json (it expires after the run
# and would break later manual pulls).
DOCKER_CONFIG_DIR=""
cleanup() {
  if [ -n "$DOCKER_CONFIG_DIR" ] && [ -d "$DOCKER_CONFIG_DIR" ]; then
    rm -rf "$DOCKER_CONFIG_DIR"
  fi
}
trap cleanup EXIT

if [ -n "${GHCR_TOKEN:-}" ]; then
  DOCKER_CONFIG_DIR="$(mktemp -d)"
  export DOCKER_CONFIG="$DOCKER_CONFIG_DIR"
  log "logging in to ghcr.io as ${GHCR_USER:-unknown}"
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-unknown}" --password-stdin >/dev/null
fi

# --- remember what is running now (for rollback) ------------------------------
APP_SERVICE="${APP_SERVICE:-app}"
PREV_CONTAINER="$(compose ps -q "$APP_SERVICE" 2>/dev/null | head -n1 || true)"
PREV_IMAGE_ID=""
if [ -n "$PREV_CONTAINER" ]; then
  PREV_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$PREV_CONTAINER" 2>/dev/null || true)"
  log "current image: ${PREV_IMAGE_ID:-unknown}"
else
  log "no running container yet (first deploy)"
fi

# --- backup before the entrypoint runs migrations ----------------------------
if [ "${BACKUP_BEFORE_DEPLOY:-1}" = "1" ] && [ -n "$PREV_CONTAINER" ]; then
  if [ "$(docker inspect -f '{{.State.Running}}' "$PREV_CONTAINER" 2>/dev/null || echo false)" = "true" ]; then
    log "backing up SQLite"
    # </dev/null is load-bearing: the workflow streams this script into
    # `bash -s` over SSH, so the script itself arrives on stdin. `docker
    # compose exec -T` forwards stdin to the container, which would swallow the
    # rest of the script — bash then hits EOF and exits 0 right here, before the
    # pull/recreate steps. Never let a compose exec read the deploy script.
    if compose exec -T "$APP_SERVICE" pnpm db:backup --prune </dev/null; then
      log "backup done"
    else
      log "WARNING: backup failed, continuing anyway"
    fi
  else
    log "app container is not running, skipping backup"
  fi
fi

# --- pull + recreate ---------------------------------------------------------
# Both steps are expected to fail sometimes: the tag may not exist yet, or
# `compose up` aborts when a depends_on health gate is never satisfied (for
# example an image built without a HEALTHCHECK). With `set -e` either failure
# would kill the script *before* the rollback block below, leaving the broken
# image running — so both are captured instead of propagated.
if [ -n "${IMAGE_REF:-}" ]; then
  log "deploying $IMAGE_REF"
  export KIRAMEKU_IMAGE="$IMAGE_REF"
fi

DEPLOY_FAILED=""

log "pulling image"
if ! compose pull "$APP_SERVICE"; then
  DEPLOY_FAILED="could not pull the new image"
fi

# --- host data directories ---------------------------------------------------
# docker-compose.yml bind-mounts the data and backup directories into the
# container, and the app runs as UID 1000. Docker creates a *missing* bind-mount
# host directory as root, which the app then cannot write to — the container
# would come up and immediately fail on the database. So create and own them
# before `compose up` touches them. Running through `compose run` keeps the host
# paths defined in exactly one place (docker-compose.yml + .env) instead of
# duplicating the KIRAMEKU_DATA_DIR / KIRAMEKU_BACKUP_DIR defaults here.
prepare_data_dirs() {
  local uid="${APP_UID:-1000}"
  if compose run --rm -T --no-deps --user 0 --entrypoint sh "$APP_SERVICE" -c \
      "mkdir -p /data/db /data/uploads /data/backups && chown \"$uid:$uid\" /data/db /data/uploads /data/backups" \
      </dev/null >/dev/null 2>&1; then
    log "data directories ready"
  else
    log "WARNING: could not prepare the bind-mounted data directories; check that KIRAMEKU_DATA_DIR and KIRAMEKU_BACKUP_DIR point at directories writable by UID $uid"
  fi
}

if [ -z "$DEPLOY_FAILED" ]; then
  prepare_data_dirs
  log "recreating containers"
  if [ -n "${SERVICES:-}" ]; then
    compose up -d --no-deps $SERVICES || DEPLOY_FAILED="docker compose up failed"
  else
    compose up -d --remove-orphans || DEPLOY_FAILED="docker compose up failed"
  fi
fi

# --- health gate -------------------------------------------------------------
wait_healthy() {
  local deadline=$((SECONDS + ${HEALTH_TIMEOUT:-180}))
  while [ "$SECONDS" -lt "$deadline" ]; do
    local container status
    container="$(compose ps -q "$APP_SERVICE" 2>/dev/null | head -n1 || true)"
    if [ -n "$container" ]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$container" 2>/dev/null || echo unknown)"
      case "$status" in
        healthy) return 0 ;;
        unhealthy | exited | dead) log "container state: $status"; return 1 ;;
      esac
    fi
    sleep 3
  done
  log "timed out waiting for a healthy container"
  return 1
}

# --- daily maintenance timer -------------------------------------------------
# Backups only ever happened as a side effect of a deploy, so a quiet month had
# no backups and visitor rows were never pruned. Install a systemd timer that
# runs scripts/maintenance.sh (backup + prune-visitors + reconcile-counts) once
# a day. Refreshing it on every deploy keeps the unit in sync with the checkout.
install_maintenance_timer() {
  local toggle="${MAINTENANCE_TIMER:-$(read_env MAINTENANCE_TIMER)}"
  [ "${toggle:-1}" = "1" ] || { log "maintenance timer disabled"; return 0; }
  [ -f scripts/maintenance.sh ] || { log "WARNING: scripts/maintenance.sh missing, no timer"; return 0; }
  if ! sudo -n true 2>/dev/null; then
    log "WARNING: passwordless sudo unavailable; skipping maintenance timer install"
    log "         install it manually (see DEPLOY_NOTES.md) or run bash scripts/maintenance.sh from cron"
    return 0
  fi

  local unit_dir=/etc/systemd/system
  local schedule="${MAINTENANCE_SCHEDULE:-$(read_env MAINTENANCE_SCHEDULE)}"
  schedule="${schedule:-*-*-* 04:30:00}"
  local deploy_dir
  deploy_dir="$(pwd)"

  sudo -n tee "$unit_dir/kirameku-maintenance.service" >/dev/null <<UNIT
[Unit]
Description=Kirameku daily maintenance (backup, prune visitors, reconcile counts)
Documentation=file://$deploy_dir/DEPLOY_NOTES.md
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$deploy_dir
Environment=DEPLOY_PATH=$deploy_dir
Environment="COMPOSE_FILE=$COMPOSE_FILES"
ExecStart=/usr/bin/env bash $deploy_dir/scripts/maintenance.sh
Nice=10
IOSchedulingClass=idle
UNIT

  sudo -n tee "$unit_dir/kirameku-maintenance.timer" >/dev/null <<UNIT
[Unit]
Description=Run Kirameku maintenance once a day

[Timer]
OnCalendar=$schedule
# Persistent=true catches up after downtime; the random delay avoids every host
# on the box (or every redeploy) firing at the same second.
Persistent=true
RandomizedDelaySec=20m
Unit=kirameku-maintenance.service

[Install]
WantedBy=timers.target
UNIT

  if sudo -n systemctl daemon-reload \
    && sudo -n systemctl enable --now kirameku-maintenance.timer >/dev/null 2>&1; then
    log "maintenance timer active ($schedule)"
  else
    log "WARNING: could not enable kirameku-maintenance.timer"
  fi
}

if [ -z "$DEPLOY_FAILED" ] && wait_healthy; then
  log "healthy"
  install_maintenance_timer
  compose ps
  if [ "${PRUNE_IMAGES:-1}" = "1" ]; then
    docker image prune -f >/dev/null 2>&1 || true
  fi
  log "deploy finished"
  exit 0
fi

# --- rollback ----------------------------------------------------------------
if [ -n "$DEPLOY_FAILED" ]; then
  log "$DEPLOY_FAILED"
else
  log "new container did not become healthy"
fi
log "recent logs:"
compose logs --tail 80 "$APP_SERVICE" || true

if [ -z "$PREV_IMAGE_ID" ]; then
  fail "no previous image to roll back to"
fi

log "rolling back to $PREV_IMAGE_ID"
# --no-deps keeps the reverse proxy untouched; only the app container is
# recreated. --pull never matters: docker-compose.yml sets `pull_policy: always`
# for normal deploys, and rolling back to a raw `sha256:...` id would otherwise
# make compose try to pull that string from a registry, which always fails.
if ! KIRAMEKU_IMAGE="$PREV_IMAGE_ID" compose up -d --no-deps --force-recreate --pull never "$APP_SERVICE"; then
  fail "rollback container failed to start; manual intervention needed"
fi
if wait_healthy; then
  log "rolled back and healthy again"
else
  log "WARNING: rollback container is also unhealthy, manual intervention needed"
fi
exit 1
