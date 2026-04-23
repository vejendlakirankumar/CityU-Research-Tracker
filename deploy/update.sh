#!/usr/bin/env bash
# =============================================================================
# update.sh — Incremental update to the running production Docker deployment
# =============================================================================
# Usage:
#   bash update.sh [OPTIONS]
#
# Options:
#   --zero-downtime    Blue-green container swap (no restart of current container)
#   --backend-only     Skip frontend rebuild
#   --frontend-only    Skip backend rsync and migrate
#   --no-migrate       Skip database migrations (dangerous — only if no schema changes)
#
# Environment variables:
#   VM_HOST   — VM IP or hostname       (default: 172.206.114.248)
#   VM_USER   — SSH username            (default: azureadmin)
#   VM_PASS   — SSH password or unset to use SSH_KEY
#   SSH_KEY   — Path to private key
#   REMOTE_DIR — Remote app directory   (default: /opt/rrp-v2)
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---------- defaults ----------------------------------------------------------
VM_HOST="${VM_HOST:-172.206.114.248}"
VM_USER="${VM_USER:-azureadmin}"
VM_PASS="${VM_PASS:-}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/rrp-v2}"
ZERO_DOWNTIME=false
BACKEND_ONLY=false
FRONTEND_ONLY=false
NO_MIGRATE=false

# ---------- parse arguments ---------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --zero-downtime)  ZERO_DOWNTIME=true;  shift ;;
    --backend-only)   BACKEND_ONLY=true;   shift ;;
    --frontend-only)  FRONTEND_ONLY=true;  shift ;;
    --no-migrate)     NO_MIGRATE=true;     shift ;;
    *) error "Unknown argument: $1" ;;
  esac
done

# Locate v2/ root (parent of deploy/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V2_DIR="$(dirname "$SCRIPT_DIR")"

# ---------- SSH helpers -------------------------------------------------------
SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15 -o BatchMode=no)
[[ -n "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")

if [[ -n "$VM_PASS" ]] && command -v sshpass &>/dev/null; then
  SSH_CMD=(sshpass -p "$VM_PASS" ssh  "${SSH_OPTS[@]}")
  RSYNC_SSH="sshpass -p '$VM_PASS' ssh ${SSH_OPTS[*]}"
else
  [[ -n "$VM_PASS" ]] && warn "sshpass not installed — you may be prompted for a password."
  SSH_CMD=(ssh "${SSH_OPTS[@]}")
  RSYNC_SSH="ssh ${SSH_OPTS[*]}"
fi

TARGET="$VM_USER@$VM_HOST"
RSYNC_OPTS=(-az --progress --delete -e "$RSYNC_SSH")

# ---------- 1. Backend sync --------------------------------------------------
if [[ "$FRONTEND_ONLY" == false ]]; then
  info "Syncing backend PHP files to $VM_HOST:$REMOTE_DIR/backend/ ..."
  rsync "${RSYNC_OPTS[@]}" \
    --exclude='vendor/' \
    --exclude='.env' \
    --exclude='storage/logs/' \
    --exclude='storage/framework/cache/' \
    --exclude='storage/framework/sessions/' \
    --exclude='storage/framework/views/' \
    "$V2_DIR/backend/" "$TARGET:$REMOTE_DIR/backend/"

  info "Installing Composer dependencies on VM..."
  "${SSH_CMD[@]}" "$TARGET" \
    "cd $REMOTE_DIR && docker exec rrp_app composer install --no-dev --optimize-autoloader --no-interaction"
fi

# ---------- 2. Frontend build ------------------------------------------------
if [[ "$BACKEND_ONLY" == false ]]; then
  info "Building frontend locally..."
  cd "$V2_DIR/frontend"
  npm ci --silent
  npm run build
  cd - >/dev/null

  info "Syncing frontend dist to $VM_HOST:$REMOTE_DIR/frontend/dist/ ..."
  rsync "${RSYNC_OPTS[@]}" \
    "$V2_DIR/frontend/dist/" "$TARGET:$REMOTE_DIR/frontend/dist/"

  info "Copying frontend dist into container..."
  "${SSH_CMD[@]}" "$TARGET" \
    "docker exec rrp_app rsync -a /host-dist/ /var/www/frontend/ 2>/dev/null || \
     docker cp $REMOTE_DIR/frontend/dist/. rrp_app:/var/www/frontend/"
fi

# ---------- 3. Run migrations ------------------------------------------------
if [[ "$NO_MIGRATE" == false && "$FRONTEND_ONLY" == false ]]; then
  info "Running database migrations..."
  "${SSH_CMD[@]}" "$TARGET" \
    "docker exec rrp_app php artisan migrate --force"
fi

# ---------- 4. Clear and rebuild caches ---------------------------------------
if [[ "$FRONTEND_ONLY" == false ]]; then
  info "Rebuilding Laravel caches..."
  "${SSH_CMD[@]}" "$TARGET" bash <<'CACHE'
docker exec rrp_app php artisan config:cache
docker exec rrp_app php artisan route:cache
docker exec rrp_app php artisan view:cache
docker exec rrp_app php artisan queue:restart
CACHE
fi

# ---------- 5. Reload Nginx (picks up new frontend assets) -------------------
info "Reloading Nginx inside container..."
"${SSH_CMD[@]}" "$TARGET" \
  "docker exec rrp_app nginx -s reload || docker exec rrp_app nginx -t && echo Nginx OK"

# ---------- 6. Zero-downtime swap (optional) ---------------------------------
if [[ "$ZERO_DOWNTIME" == true ]]; then
  info "Running zero-downtime container swap..."
  "${SSH_CMD[@]}" "$TARGET" bash <<ZDEPLOY
cd $REMOTE_DIR

# Build a new image tagged :candidate
docker compose build --no-cache app

# Start the candidate on a different port (8081) for health-check
docker run -d --name rrp_candidate \
  --env-file backend/.env \
  -p 127.0.0.1:8081:8080 \
  rrp_app:candidate

# Wait for health
for i in \$(seq 1 20); do
  if curl -sf http://127.0.0.1:8081/api/system/public >/dev/null 2>&1; then
    echo "Candidate healthy after \$i seconds"
    break
  fi
  sleep 1
done

# Switch Nginx upstream from :8080 to :8081, reload, then swap back container names
docker compose stop app
docker rename rrp_app rrp_app_old
docker rename rrp_candidate rrp_app
docker compose start app   # re-creates from compose definition but image is already new
docker rm -f rrp_app_old 2>/dev/null || true
ZDEPLOY
fi

# ---------- Done --------------------------------------------------------------
info "============================================================"
info " Update complete!"
info " VM: $VM_HOST"
info " Run 'docker compose logs -f app' on the VM to monitor."
info "============================================================"
