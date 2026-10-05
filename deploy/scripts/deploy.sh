#!/usr/bin/env bash
# Deploys the latest dashboard. Run as root, from anywhere:
#
#   ./deploy/scripts/deploy.sh
#
#   1. git pull (fast-forward only; SKIP_PULL=1 skips it)
#   2. build the image (NEXT_PUBLIC_API_BASE from .env is baked in)
#   3. restart the container and wait for its health check
#   4. remove old images
#
# If the dashboard fails its health check, the script prints its last log lines
# and exits non-zero.

set -euo pipefail

die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# Everything runs inside main() so bash reads the whole file before `git pull`
# can change it underneath.
main() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.."
  local compose=(docker compose -f docker-compose.prod.yml)

  # One deploy at a time.
  exec 9>.deploy.lock
  if ! flock -n 9; then
    echo "Another deploy is running; waiting for it to finish…"
    flock 9
  fi

  [ -f .env ] || die "No .env yet. Run: cp .env.production.example .env"
  grep -qE '^NEXT_PUBLIC_API_BASE=https?://' .env \
    || die "Set NEXT_PUBLIC_API_BASE in .env (see .env.production.example)."

  if [ "${SKIP_PULL:-0}" != "1" ]; then
    step "Pulling the latest code"
    git pull --ff-only
  fi
  step "Deploying $(git log -1 --format='%h %s')"

  step "Building the image"
  "${compose[@]}" build

  step "Restarting the dashboard"
  if ! "${compose[@]}" up -d --wait --wait-timeout 120 web; then
    "${compose[@]}" logs --tail=80 web || true
    die "The dashboard did not become healthy. Its last log lines are above."
  fi

  step "Checking the dashboard"
  curl -fsS -o /dev/null -w 'GET /login -> %{http_code}\n' http://127.0.0.1:3001/login

  step "Removing old images"
  docker image prune -f >/dev/null

  echo
  echo "Deployed $(git log -1 --format='%h')."
}

main "$@"
