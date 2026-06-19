#!/usr/bin/env bash
# =============================================================================
# update.sh — Reliable update to the running production Docker deployment
# =============================================================================
# Usage:
#   bash update.sh [OPTIONS]
#
# Options:
#   --zero-downtime    Reserved for future use; currently not supported
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

command -v ssh &>/dev/null   || error "ssh is required on the local machine"
command -v rsync &>/dev/null || error "rsync is required on the local machine"

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

if [[ "$ZERO_DOWNTIME" == true ]]; then
  error "--zero-downtime is not currently supported by this script. Use a standard update instead."
fi

REMOTE_DOCKER='docker'
REMOTE_DOCKER_PROBE='if ! docker info >/dev/null 2>&1; then DOCKER="sudo docker"; else DOCKER="docker"; fi'

# ---------- 1. Sync repository files -----------------------------------------
info "Syncing application files to $VM_HOST:$REMOTE_DIR ..."
mkdir -p "$V2_DIR/frontend/dist" >/dev/null 2>&1 || true

RSYNC_EXCLUDES=(
  --exclude='.git/'
  --exclude='node_modules/'
  --exclude='backend/vendor/'
  --exclude='.env'
)

if [[ "$BACKEND_ONLY" == true ]]; then
  RSYNC_EXCLUDES+=(--exclude='frontend/')
fi

if [[ "$FRONTEND_ONLY" == true ]]; then
  RSYNC_EXCLUDES+=(--exclude='backend/' --exclude='docker-compose.yml' --exclude='Dockerfile')
fi

rsync "${RSYNC_OPTS[@]}" "${RSYNC_EXCLUDES[@]}" \
  "$V2_DIR/" "$TARGET:$REMOTE_DIR/"

# ---------- 2. Rebuild and restart stack -------------------------------------
info "Rebuilding Docker stack on VM..."
"${SSH_CMD[@]}" "$TARGET" bash <<REMOTE_UPDATE
set -euo pipefail
cd $REMOTE_DIR
$REMOTE_DOCKER_PROBE

\$DOCKER compose up -d --build

ATTEMPTS=0
until \$DOCKER inspect --format='{{.State.Health.Status}}' rrp_app 2>/dev/null | grep -q 'healthy'; do
  ATTEMPTS=\$((ATTEMPTS + 1))
  if [[ \$ATTEMPTS -ge 40 ]]; then
    echo 'ERROR: Timed out waiting for rrp_app health. Recent logs:'
    \$DOCKER compose logs --tail=40 app
    exit 1
  fi
  sleep 5
done

if [[ "$NO_MIGRATE" == false && "$FRONTEND_ONLY" == false ]]; then
  \$DOCKER exec -w /var/www/html rrp_app php artisan migrate --force
fi

if [[ "$FRONTEND_ONLY" == false ]]; then
  \$DOCKER exec -w /var/www/html rrp_app php artisan config:cache
  \$DOCKER exec -w /var/www/html rrp_app php artisan route:cache
  \$DOCKER exec -w /var/www/html rrp_app php artisan queue:restart || true
fi

\$DOCKER exec rrp_app nginx -t
\$DOCKER exec rrp_app nginx -s reload || true
REMOTE_UPDATE

# ---------- Done --------------------------------------------------------------
info "============================================================"
info " Update complete!"
info " VM: $VM_HOST"
info " Run 'docker compose logs -f app' on the VM to monitor."
info "============================================================"
