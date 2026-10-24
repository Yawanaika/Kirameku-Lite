#!/usr/bin/env bash
#
# Off-process health probe for the deployed stack.
#
# The in-process scheduler (server/modules/notifications) only knows that *this*
# Node process is alive: it cannot see a proxy that stopped routing, a stopped
# cloudflared, or a container that is up but unhealthy. This script runs on the
# host, dials the public /api/health, and reports failures through
# POST /api/internal/notify.
#
# Delivery deliberately tries the container address on the docker network first:
# that path still works when the *proxy* is what broke, which is exactly the
# layer this probe exists to cover. It cannot cover a dead host or a dead stack
# — nothing on the machine can send anything then. That case belongs to the
# off-host probe in ops/cloudflare-probe (see DEPLOY_NOTES.md section 6.6).
#
# Normally executed by the kirameku-probe systemd timer, installed by
# scripts/deploy-server.sh. Manual run:
#
#   cd /home/ubuntu/services/Kirameku-Lite
#   bash scripts/probe-health.sh
#   bash scripts/probe-health.sh --dry-run    # report only, never notify
#
# Environment: read from .env (last occurrence wins); a value already exported
# in the calling environment wins over .env.
#   SITE_URL / FRONTEND_ORIGIN  base for the default target
#   CRON_SECRET                 required to notify; without it the run only logs
#   PROBE_URL                   target; default <base>/api/health
#   PROBE_TIMEOUT               curl timeout in seconds (default 10)
#   PROBE_FAIL_THRESHOLD        consecutive failures before alerting (default 2)
#   PROBE_NOTIFY                0 = log only, never notify (default 1)
#   PROBE_LOG_MAX_BYTES         rotate probe.log past this size (default 1 MiB)
#   APP_SERVICE / APP_PORT      container and port used for direct delivery
#   COMPOSE_FILE                compose file(s), space separated
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
LOG_DIR="${PROBE_LOG_DIR:-$DEPLOY_PATH/logs}"
LOG_FILE="$LOG_DIR/probe.log"
LOG_MAX_BYTES="${PROBE_LOG_MAX_BYTES:-1048576}"
STATE_FILE="$LOG_DIR/.probe-state"
LOCK_FILE="$LOG_DIR/.probe.lock"
COMPOSE_FILES="${COMPOSE_FILE:-docker-compose.yml}"
APP_SERVICE="${APP_SERVICE:-app}"
APP_PORT="${APP_PORT:-3000}"

log() { printf '%s [probe] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { printf '[probe] ERROR: %s\n' "$*" >&2; exit 1; }

cd "$DEPLOY_PATH" 2>/dev/null || fail "cannot enter $DEPLOY_PATH"
mkdir -p "$LOG_DIR"

# Keep probe.log bounded the same way maintenance.sh does: one generation back.
if [ -f "$LOG_FILE" ]; then
  size="$(wc -c <"$LOG_FILE" | tr -d '[:space:]')"
  if [ "${size:-0}" -gt "$LOG_MAX_BYTES" ]; then
    mv -f "$LOG_FILE" "$LOG_FILE.1"
  fi
fi

# One probe at a time — a manual run overlapping the timer would double-count
# failures and send two alerts for the same outage. flock is util-linux, so a
# developer running this by hand on macOS does not have it: warn and continue
# unlocked there rather than silently skipping every probe.
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "another probe run is in progress, skipping"
    exit 0
  fi
else
  log "WARNING: flock not found; running without a lock (fine for a manual run, not on the server)"
fi

# From here on everything goes to the log file. The alert channel is the
# notification, not the unit's exit status, so an unreachable site still exits 0
# and does not show up as a failed unit in systemctl.
exec >>"$LOG_FILE" 2>&1

[ -f .env ] || fail "missing .env in $DEPLOY_PATH (copy compose.env.example and fill it in)"

# Read KEY from .env (last occurrence wins), mirroring scripts/deploy-server.sh.
read_env() {
  local key="$1" line value=""
  while IFS= read -r line; do
    case "$line" in
      "$key"=*) value="${line#*=}" ;;
    esac
  done < .env
  value="${value#\"}"; value="${value%\"}"
  value="${value#\'}"; value="${value%\'}"
  printf '%s' "$value"
}

# Environment wins over .env; fall back to the supplied default.
env_value() {
  local key="$1" fallback="${2:-}" value
  value="${!key:-}"
  [ -n "$value" ] || value="$(read_env "$key")"
  [ -n "$value" ] || value="$fallback"
  printf '%s' "$value"
}

dry_run=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    *) fail "unknown argument: $arg (supported: --dry-run)" ;;
  esac
done

base_url="$(env_value SITE_URL "$(env_value FRONTEND_ORIGIN "")")"
base_url="${base_url%/}"
target="$(env_value PROBE_URL "${base_url:+$base_url/api/health}")"
[ -n "$target" ] || fail "no target: set SITE_URL (or FRONTEND_ORIGIN / PROBE_URL) in .env"
timeout_s="$(env_value PROBE_TIMEOUT 10)"
threshold="$(env_value PROBE_FAIL_THRESHOLD 2)"
notify_enabled="$(env_value PROBE_NOTIFY 1)"
secret="$(env_value CRON_SECRET "")"

case "$threshold" in ''|*[!0-9]*) threshold=2 ;; esac
[ "$threshold" -ge 1 ] || threshold=1
case "$timeout_s" in ''|*[!0-9]*) timeout_s=10 ;; esac

compose_files_args=()
for file in $COMPOSE_FILES; do compose_files_args+=(-f "$file"); done
compose() { docker compose "${compose_files_args[@]}" "$@"; }

# Router-reachable address of the app container: still valid when the reverse
# proxy is the broken part, which is the whole point of probing from here.
direct_base() {
  local id ip
  id="$(compose ps -q "$APP_SERVICE" 2>/dev/null | head -n 1 || true)"
  [ -n "$id" ] || return 1
  ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{println .IPAddress}}{{end}}' "$id" 2>/dev/null \
    | grep -m 1 -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true)"
  [ -n "$ip" ] || return 1
  printf 'http://%s:%s' "$ip" "$APP_PORT"
}

json_escape() { printf '%s' "$1" | tr -d '\r\n\t' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

notify() {
  local level="$1" title="$2" body="$3" payload url response base
  # accepted = the endpoint returned a delivery verdict at all; delivered = it
  # actually pushed the alert. Only the second one means the probe is done.
  local accepted=0 delivered=0
  if [ "$dry_run" = "1" ]; then
    log "dry-run: would notify [$level] $title"
    return 0
  fi
  if [ "$notify_enabled" != "1" ]; then
    log "notification skipped (PROBE_NOTIFY=$notify_enabled)"
    return 0
  fi
  if [ -z "$secret" ]; then
    log "WARNING: CRON_SECRET is not set; cannot notify (only logging)"
    return 0
  fi

  payload="$(printf '{"eventKey":"site.health","level":"%s","title":"%s","body":"%s","fields":[{"label":"target","value":"%s"},{"label":"http","value":"%s"},{"label":"probe","value":"host:systemd-timer"},{"label":"host","value":"%s"}],"link":"%s"}' \
    "$level" "$(json_escape "$title")" "$(json_escape "$body")" "$(json_escape "$target")" \
    "$(json_escape "$http_code")" "$(json_escape "$(hostname)")" "$(json_escape "$target")")"

  for base in "$(direct_base || true)" "$base_url"; do
    [ -n "$base" ] || continue
    url="$base/api/internal/notify"
    response="$(curl -sS -m "$timeout_s" -X POST "$url" \
      -H "Authorization: Bearer $secret" -H 'content-type: application/json' \
      -d "$payload" 2>&1 || true)"
    log "notify via $url -> ${response:-<no response>}"
    # Match the value, not just the key: '"sent":' is a prefix of '"sent":false'
    # as well, so key-only matching cannot tell a delivered alert from one the
    # endpoint accepted and then dropped (event off / no channel / cooldown).
    # Both addresses reach the same app and the same database, so the first
    # verdict ends the loop either way.
    case "$response" in
      *'"sent":true'*)
        accepted=1; delivered=1
        break
        ;;
      *'"sent":false'*)
        accepted=1
        break
        ;;
    esac
  done

  if [ "$delivered" = "1" ]; then
    return 0
  fi

  # "sent":false is a normal answer for this event: site.health carries a 900s
  # server-side cooldown while the timer fires every 5 minutes, so every round
  # after the first alert of a continuing outage lands here.
  if [ "$accepted" = "1" ]; then
    log "WARNING: endpoint accepted the call but sent nothing (see reason above); this alert was not delivered"
    return 0
  fi

  log "WARNING: no delivery path worked; only an off-host probe (ops/cloudflare-probe) can report this state"
}

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

http_code="$(curl -sS -m "$timeout_s" -o "$body_file" -w '%{http_code}' "$target" 2>/dev/null || printf '000')"
body="$(head -c 500 "$body_file" 2>/dev/null | tr -d '\r\n')"

healthy=0
if [ "$http_code" = "200" ] && printf '%s' "$body" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
  healthy=1
fi

previous_fails=0
previous_state="ok"
alerted=0
if [ -f "$STATE_FILE" ]; then
  previous_fails="$(sed -n 's/^fails=//p' "$STATE_FILE" | tail -n 1)"
  previous_state="$(sed -n 's/^state=//p' "$STATE_FILE" | tail -n 1)"
  alerted="$(sed -n 's/^alerted=//p' "$STATE_FILE" | tail -n 1)"
  case "$previous_fails" in ''|*[!0-9]*) previous_fails=0 ;; esac
  case "$alerted" in ''|*[!0-9]*) alerted=0 ;; esac
  [ -n "$previous_state" ] || previous_state=ok
fi

if [ "$healthy" = "1" ]; then
  log "ok: http 200 $target"
  if [ "$previous_state" != "ok" ] && [ "$alerted" = "1" ]; then
    notify "info" "外部探针：站点已恢复" "恢复前连续失败 $previous_fails 次。"
  fi
  fails=0
  state=ok
  alerted=0
else
  fails=$((previous_fails + 1))
  state=fail
  log "FAIL: http $http_code $target (第 $fails 次，阈值 $threshold) ${body:0:200}"
  if [ "$fails" -ge "$threshold" ]; then
    notify "critical" "外部探针：站点不可达" "连续 ${fails} 次探测失败（阈值 ${threshold}）。响应：${body:0:180}"
    [ "$dry_run" = "1" ] || alerted=1
  else
    log "低于阈值，等下一次探测"
  fi
fi

if [ "$dry_run" = "0" ]; then
  state_tmp="$STATE_FILE.tmp"
  printf 'fails=%s\nstate=%s\nalerted=%s\nhttp=%s\nts=%s\n' \
    "$fails" "$state" "$alerted" "$http_code" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$state_tmp"
  mv -f "$state_tmp" "$STATE_FILE"
fi

exit 0
