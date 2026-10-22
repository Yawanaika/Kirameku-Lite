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
#   PRUNE_IMAGES           1 = drop dangling images after a successful deploy (default: 1)
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
if [ -z "${SHARED_NETWORK:-}" ] && [ -f .env ]; then
  # Read it from .env so the network created here is the one compose will join.
  SHARED_NETWORK="$(sed -n 's/^SHARED_NETWORK=//p' .env | tail -n1 | tr -d '\r' | sed -e "s/^[\"' ]*//" -e "s/[\"' ]*$//")"
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
    if compose exec -T "$APP_SERVICE" pnpm db:backup --prune; then
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

if [ -z "$DEPLOY_FAILED" ]; then
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

if [ -z "$DEPLOY_FAILED" ] && wait_healthy; then
  log "healthy"
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
