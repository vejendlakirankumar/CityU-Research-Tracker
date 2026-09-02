#!/usr/bin/env bash
# =============================================================================
# prod-update.sh — Pull latest code from git and deploy it on the PROD VM
# =============================================================================
# Run this ON the production VM (as root or with sudo). It updates the live
# bare-metal deployment (nginx + php8.4-fpm "rrp" pool + supervisor worker).
#
#   sudo bash /opt/rrp/source/deploy/prod-update.sh
#
# Options:
#   --backend-only    Skip the frontend rebuild
#   --frontend-only   Skip backend rsync / composer / migrate
#   --no-migrate      Skip database migrations (only if there are no schema changes)
#   --branch <name>   Deploy a branch other than main
#
# Overridable environment variables (defaults match this server):
#   SRC       git clone dir            (default: /opt/rrp/source)
#   APP       live app root            (default: /var/www/rrp)
#   APP_USER  runtime/php-fpm user     (default: rrp)
#   PHP       php cli binary           (default: php8.4)
#   FPM_SVC   php-fpm service name     (default: php8.4-fpm)
#   WORKER    supervisor worker group  (default: rrp-worker:*)
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---------- config ------------------------------------------------------------
SRC="${SRC:-/opt/rrp/source}"
APP="${APP:-/var/www/rrp}"
APP_USER="${APP_USER:-rrp}"
PHP="${PHP:-php8.4}"
FPM_SVC="${FPM_SVC:-php8.4-fpm}"
WORKER="${WORKER:-rrp-worker:*}"
BRANCH="main"

BACKEND_ONLY=false
FRONTEND_ONLY=false
NO_MIGRATE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only)  BACKEND_ONLY=true;  shift ;;
    --frontend-only) FRONTEND_ONLY=true; shift ;;
    --no-migrate)    NO_MIGRATE=true;    shift ;;
    --branch)        BRANCH="${2:?--branch needs a value}"; shift 2 ;;
    *) error "Unknown argument: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || error "Please run as root (sudo)."
BE="$(readlink -f "$APP")/backend"
[[ -d "$SRC/.git" ]] || error "No git clone at $SRC"
[[ -f "$BE/artisan" ]] || error "No Laravel app at $BE (set APP=/path/to/app if the live root differs)"

# Run artisan/composer as the app user with a stable HOME (matches file ownership)
asuser() { sudo -u "$APP_USER" env HOME="$(readlink -f "$APP")" "$@"; }

# git wrapper that tolerates running as root against a clone owned by another user
git_src() { git -C "$SRC" -c safe.directory="$SRC" "$@"; }

# ---------- 1. Pull latest code ----------------------------------------------
info "Fetching $BRANCH into $SRC ..."
git_src fetch --prune origin "$BRANCH"
git_src reset --hard "origin/$BRANCH"
DEPLOYED_SHA="$(git_src rev-parse --short HEAD)"
info "At commit $DEPLOYED_SHA"

# ---------- 2. Backend --------------------------------------------------------
if [[ "$FRONTEND_ONLY" == false ]]; then
  info "Syncing backend code -> $BE ..."
  # Sync tracked code but never touch runtime state (.env, storage, vendor, cache).
  rsync -a --delete \
    --exclude='.env' \
    --exclude='storage/' \
    --exclude='vendor/' \
    --exclude='bootstrap/cache/' \
    "$SRC/backend/" "$BE/"

  info "Installing composer dependencies ..."
  ( cd "$BE" && asuser composer install --no-dev --optimize-autoloader --no-interaction )

  chown -R "$APP_USER:$APP_USER" "$BE"

  if [[ "$NO_MIGRATE" == false ]]; then
    info "Running migrations ..."
    ( cd "$BE" && asuser "$PHP" artisan migrate --force )
  else
    warn "Skipping migrations (--no-migrate)."
  fi

  info "Rebuilding config/route caches ..."
  ( cd "$BE" && asuser "$PHP" artisan optimize:clear )
  ( cd "$BE" && asuser "$PHP" artisan config:cache )
  ( cd "$BE" && asuser "$PHP" artisan route:cache )
fi

# ---------- 3. Frontend -------------------------------------------------------
if [[ "$BACKEND_ONLY" == false ]]; then
  info "Building frontend ..."
  ( cd "$SRC/frontend" && npm ci && npm run build )
  DIST="$(readlink -f "$APP")/frontend-dist"
  info "Publishing build -> $DIST ..."
  rsync -a --delete "$SRC/frontend/dist/" "$DIST/"
  chown -R "$APP_USER:$APP_USER" "$DIST"
fi

# ---------- 4. Reload services -----------------------------------------------
if [[ "$FRONTEND_ONLY" == false ]]; then
  info "Reloading PHP-FPM and restarting queue worker ..."
  systemctl reload "$FPM_SVC"
  supervisorctl restart "$WORKER" || ( cd "$BE" && asuser "$PHP" artisan queue:restart ) || true
fi

info "Validating and reloading nginx ..."
nginx -t && systemctl reload nginx

info "============================================================"
info " Deploy complete — commit $DEPLOYED_SHA is now live."
info "============================================================"
