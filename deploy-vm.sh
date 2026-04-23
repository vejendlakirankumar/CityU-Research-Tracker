#!/usr/bin/env bash
# =============================================================================
#  deploy-vm.sh  —  Deploy v2 to existing Azure VM on port 8080
#  Usage:  ./deploy-vm.sh [--env-file /path/to/.env.production]
#
#  Prerequisites on VM:
#    - Docker + Docker Compose v2
#    - SSH access to $VM_HOST as $VM_USER
#    - The .env.production file created from .env.example
# =============================================================================

set -euo pipefail

VM_USER="${VM_USER:-azureuser}"
VM_HOST="${VM_HOST:-rcgapimtest.eastus2.cloudapp.azure.com}"
VM_PATH="${VM_PATH:-/opt/rrp-v2}"
SSH_KEY="${SSH_KEY:-~/.ssh/id_rsa}"
ENV_FILE="${1:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { echo "[deploy] $*"; }

# ── 1. Sync code to VM ────────────────────────────────────────────────────────
log "Syncing code to ${VM_HOST}:${VM_PATH} ..."

ssh -i "$SSH_KEY" "${VM_USER}@${VM_HOST}" "mkdir -p ${VM_PATH}"

rsync -az --delete \
  --exclude='node_modules' \
  --exclude='vendor' \
  --exclude='.env' \
  --exclude='frontend/dist' \
  --exclude='backend/bootstrap/cache/*.php' \
  --exclude='backend/storage/logs' \
  --exclude='backend/storage/framework/cache' \
  -e "ssh -i ${SSH_KEY}" \
  "${SCRIPT_DIR}/" \
  "${VM_USER}@${VM_HOST}:${VM_PATH}/"

# ── 2. Upload .env.production if provided ────────────────────────────────────
if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
  log "Uploading env file ..."
  scp -i "$SSH_KEY" "$ENV_FILE" "${VM_USER}@${VM_HOST}:${VM_PATH}/.env.production"
fi

# ── 3. Build & start on VM ────────────────────────────────────────────────────
log "Building and starting services on VM ..."

ssh -i "$SSH_KEY" "${VM_USER}@${VM_HOST}" bash -s << 'REMOTE'
set -euo pipefail
cd /opt/rrp-v2

# Load production env vars from file if present
if [[ -f .env.production ]]; then
  set -a
  source .env.production
  set +a
fi

# Pull/build and start
docker compose -f docker-compose.yml pull --quiet 2>/dev/null || true
docker compose -f docker-compose.yml build --no-cache --quiet
docker compose -f docker-compose.yml up -d

# Wait for app container to be healthy
echo "Waiting for app container ..."
for i in $(seq 1 30); do
  STATUS=$(docker compose ps --format json app 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health',''))" 2>/dev/null || echo "")
  if [[ "$STATUS" == "healthy" ]]; then
    echo "App is healthy."
    break
  fi
  echo "  attempt $i/30 — status: ${STATUS:-starting}"
  sleep 5
done

echo "Deployment complete. App running on http://$(hostname -f):8080"
REMOTE

log "Done. Visit: http://${VM_HOST}:8080"
