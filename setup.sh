#!/usr/bin/env bash
# =============================================================================
#  setup.sh  —  First-time setup on the VM (run once after initial deploy)
#
#  Run on the VM:
#    cd /opt/rrp-v2 && bash setup.sh
#
#  What it does:
#    1. Checks prerequisites
#    2. Creates .env.production from .env.example if absent
#    3. Starts docker compose
#    4. Runs migrations + seeds
# =============================================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${APP_DIR}/.env.production"

log()  { echo -e "\033[32m[setup]\033[0m $*"; }
warn() { echo -e "\033[33m[warn]\033[0m $*"; }
err()  { echo -e "\033[31m[error]\033[0m $*" >&2; exit 1; }

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || err "Docker not installed."
docker compose version >/dev/null 2>&1 || err "Docker Compose v2 not installed."

# ── .env.production ───────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env.production not found. Generating with safe defaults ..."

  APP_KEY="base64:$(openssl rand -base64 32)"
  DB_PASS="$(openssl rand -base64 18 | tr -d '=+/')"
  REDIS_PASS="$(openssl rand -base64 18 | tr -d '=+/')"

  cat > "$ENV_FILE" << EOF
APP_NAME="Research Review Portal"
APP_ENV=production
APP_KEY=${APP_KEY}
APP_DEBUG=false
APP_URL=http://$(curl -sf http://checkip.amazonaws.com || echo "localhost"):8080

DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=rrp
DB_USERNAME=rrp_app
DB_PASSWORD=${DB_PASS}

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASS}

POSTGRES_DB=rrp
POSTGRES_USER=rrp_app
POSTGRES_PASSWORD=${DB_PASS}
REDIS_REQUIREPASS=${REDIS_PASS}

FILESYSTEM_DISK=local
SANCTUM_STATEFUL_DOMAINS=localhost,localhost:8080

LOG_CHANNEL=daily
LOG_LEVEL=error
EOF

  log ".env.production created with generated secrets."
  warn "IMPORTANT: Back up .env.production — it contains your database passwords."
fi

# Load env
set -a; source "$ENV_FILE"; set +a

# ── Start services ────────────────────────────────────────────────────────────
log "Starting Docker services ..."
cd "$APP_DIR"
docker compose up -d --build

# ── Wait for database ─────────────────────────────────────────────────────────
log "Waiting for PostgreSQL to be ready ..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > /dev/null 2>&1; then
    log "PostgreSQL is ready."
    break
  fi
  echo "  attempt $i/30 ..."
  sleep 3
done

# ── Run migrations ────────────────────────────────────────────────────────────
log "Running database migrations ..."
docker compose exec -T app php artisan migrate --force

# ── Seed database ─────────────────────────────────────────────────────────────
read -rp "Seed with demo data? (yes/no) [no]: " SEED_CONFIRM
if [[ "${SEED_CONFIRM,,}" == "yes" || "${SEED_CONFIRM,,}" == "y" ]]; then
  log "Seeding database ..."
  docker compose exec -T app php artisan db:seed --force
  log "Seeded. Demo credentials:"
  echo ""
  echo "  admin@rrp.local         Admin@RRP2026!"
  echo "  coordinator1@rrp.local  Coord@RRP2026!"
  echo "  reviewer1@rrp.local     Review@RRP2026!"
  echo "  student1@rrp.local      Student@RRP2026!"
  echo ""
fi

# ── Summary ───────────────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -sf http://checkip.amazonaws.com || echo "your-server-ip")
log "Setup complete!"
echo ""
echo "  Application: http://${PUBLIC_IP}:8080"
echo ""
echo "  To check logs:         docker compose logs -f app"
echo "  To run artisan:        docker compose exec app php artisan ..."
echo "  To restart:            docker compose restart app"
echo "  To stop all:           docker compose down"
echo ""
