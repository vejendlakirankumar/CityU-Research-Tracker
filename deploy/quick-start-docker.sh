#!/usr/bin/env bash
# =============================================================================
# quick-start-docker.sh — One-command Docker Compose deployment for RRP
# =============================================================================
# Brings up the full portal stack (app, worker, postgres, redis) on any
# machine that has Docker Engine 24+ and Docker Compose v2.
#
# Usage:
#   bash deploy/quick-start-docker.sh [OPTIONS]
#
# Options:
#   --domain  DOMAIN   Public hostname or IP  (default: localhost)
#   --port    PORT     Host HTTP port to bind (default: 80)
#   --https            Provision a Let's Encrypt cert after start
#                      Requires: real domain, DNS live, root/sudo, ADMIN_EMAIL set
#   --no-seed          Skip demo account seeding (recommended for production)
#   --env-file FILE    Use an existing .env file instead of auto-generating one
#
# Environment variables (optional overrides):
#   ADMIN_EMAIL        Required when using --https
#
# Examples:
#   # Local dev on http://localhost
#   bash deploy/quick-start-docker.sh
#
#   # Local dev on a non-standard port (e.g. http://localhost:8080)
#   bash deploy/quick-start-docker.sh --port 8080
#
#   # Production server — auto-generate .env, start stack, provision SSL
#   export ADMIN_EMAIL=admin@myorg.com
#   sudo bash deploy/quick-start-docker.sh --domain portal.myorg.com --https --no-seed
#
#   # Production with existing .env and no SSL (behind a load balancer)
#   bash deploy/quick-start-docker.sh --domain myorg.com --port 8080 \
#        --no-seed --env-file /etc/rrp/.env
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
step()  { echo -e "\n${CYAN}══ $* ══${NC}"; }

# ---------- locate repo root --------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_DIR/.env"
COMPOSE_FILE="$REPO_DIR/docker-compose.yml"

# ---------- defaults ----------------------------------------------------------
DOMAIN="localhost"
HOST_PORT="80"
RUN_HTTPS=false
SEED=true
CUSTOM_ENV_FILE=""

# ---------- parse arguments ---------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)    DOMAIN="$2";           shift 2 ;;
    --port)      HOST_PORT="$2";        shift 2 ;;
    --https)     RUN_HTTPS=true;        shift   ;;
    --no-seed)   SEED=false;            shift   ;;
    --env-file)  CUSTOM_ENV_FILE="$2";  shift 2 ;;
    *) error "Unknown argument: $1  (valid: --domain, --port, --https, --no-seed, --env-file)" ;;
  esac
done

# ---------- preflight ---------------------------------------------------------
step "Checking prerequisites"

# When SSL termination is enabled, the host Nginx owns port 80/443.
# Docker must bind an internal port so there is no conflict.
if [[ "$RUN_HTTPS" == true && "$HOST_PORT" == "80" ]]; then
  HOST_PORT="8080"
  info "SSL mode: Docker container will listen on host port $HOST_PORT; host Nginx will own 80/443."
fi

command -v docker &>/dev/null || \
  error "Docker is not installed. Install it from https://docs.docker.com/engine/install/"
docker info &>/dev/null 2>&1 || \
  error "Docker daemon is not running. Start it first (e.g. sudo systemctl start docker)."

if docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
  warn "Using legacy docker-compose v1. Upgrade to Docker Compose v2 when possible."
else
  error "Docker Compose is not installed. See https://docs.docker.com/compose/install/"
fi

info "Docker   : $(docker --version)"
info "Compose  : $($COMPOSE version)"

if [[ "$RUN_HTTPS" == true ]]; then
  [[ $EUID -ne 0 ]] && error "--https requires root. Re-run: sudo bash $0 $*"
  [[ -z "${ADMIN_EMAIL:-}" ]] && \
    error "Set ADMIN_EMAIL before using --https:  export ADMIN_EMAIL=you@example.com"
fi

# ---------- prepare environment file -----------------------------------------
step "Preparing environment"

if [[ -n "$CUSTOM_ENV_FILE" ]]; then
  [[ -f "$CUSTOM_ENV_FILE" ]] || error "--env-file not found: $CUSTOM_ENV_FILE"
  cp "$CUSTOM_ENV_FILE" "$ENV_FILE"
  info "Using provided environment file: $CUSTOM_ENV_FILE"

elif [[ -f "$ENV_FILE" ]]; then
  info ".env already exists — skipping auto-generation."
  info "Delete $ENV_FILE and re-run to regenerate with new credentials."

else
  info "Generating .env for domain='$DOMAIN' port='$HOST_PORT' ..."

  # Require openssl for key generation
  command -v openssl &>/dev/null || error "openssl is required to generate secrets. Install it first."

  APP_KEY="base64:$(openssl rand -base64 32)"
  DB_PASS="$(openssl rand -hex 24)"
  REDIS_PASS="$(openssl rand -hex 16)"

  # Determine APP_URL
  if [[ "$DOMAIN" == "localhost" || "$DOMAIN" == "127.0.0.1" ]]; then
    if [[ "$HOST_PORT" == "80" ]]; then
      APP_URL="http://localhost"
    else
      APP_URL="http://localhost:$HOST_PORT"
    fi
    SESSION_DOM="localhost"
    STATEFUL_DOMS="localhost,localhost:$HOST_PORT"
  elif [[ "$RUN_HTTPS" == true ]]; then
    APP_URL="https://$DOMAIN"
    SESSION_DOM="$DOMAIN"
    STATEFUL_DOMS="$DOMAIN"
  else
    APP_URL="http://$DOMAIN"
    SESSION_DOM="$DOMAIN"
    STATEFUL_DOMS="$DOMAIN"
  fi

  cat > "$ENV_FILE" <<EOF
# Generated by quick-start-docker.sh on $(date -u +"%Y-%m-%d %H:%M UTC")
# Edit this file to configure email, SSO, Turnitin, and other integrations.
# Then run: docker exec rrp_app php artisan config:cache

APP_NAME="Research Review Portal"
APP_ENV=production
APP_KEY=$APP_KEY
APP_DEBUG=false
APP_URL=$APP_URL
LOG_CHANNEL=stderr
LOG_LEVEL=error

DB_DATABASE=rrp_production
DB_USERNAME=rrp_app
DB_PASSWORD=$DB_PASS

REDIS_PASSWORD=$REDIS_PASS

SESSION_DOMAIN=$SESSION_DOM
SANCTUM_STATEFUL_DOMAINS=$STATEFUL_DOMS

# Email — change MAIL_MAILER from 'log' to 'smtp' and fill in your SMTP details
MAIL_MAILER=log
MAIL_FROM_ADDRESS=noreply@$DOMAIN
MAIL_FROM_NAME="Research Review Portal"

FILESYSTEM_DISK=local
EOF

  info ".env generated with fresh credentials."
fi

# ---------- start the stack ---------------------------------------------------
step "Building and starting containers (this may take a few minutes on first run)"

cd "$REPO_DIR"

# Pass HOST_PORT to docker compose so the port binding picks it up
export HOST_PORT="$HOST_PORT"

info "Running: $COMPOSE up -d --build"
$COMPOSE -f "$COMPOSE_FILE" up -d --build

# ---------- wait for the app container to be healthy --------------------------
step "Waiting for application to become healthy"

ATTEMPTS=0
MAX_ATTEMPTS=40   # 40 × 5s = 3m20s maximum wait
until docker inspect --format='{{.State.Health.Status}}' rrp_app 2>/dev/null | grep -q "healthy"; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; then
    warn "Timed out waiting for healthy status. Showing recent logs:"
    $COMPOSE -f "$COMPOSE_FILE" logs --tail=40 app
    error "Startup failed. Fix the errors above and re-run."
  fi
  echo -n "."
  sleep 5
done
echo ""
info "Application container is healthy."

# ---------- database migrations -----------------------------------------------
step "Running database migrations"

docker exec -w /var/www/html rrp_app php artisan migrate --force
docker exec -w /var/www/html rrp_app php artisan storage:link 2>/dev/null || true

if [[ "$SEED" == true ]]; then
  info "Seeding default accounts..."
  docker exec -w /var/www/html rrp_app php artisan db:seed --force
  echo ""
  warn "Demo accounts created — CHANGE THESE PASSWORDS before production use."
fi

# ---------- optional SSL ------------------------------------------------------
if [[ "$RUN_HTTPS" == true ]]; then
  step "Provisioning Let's Encrypt SSL certificate"
  bash "$SCRIPT_DIR/ssl-setup.sh" "$DOMAIN" "${ADMIN_EMAIL}" "$HOST_PORT"
fi

# ---------- print summary -----------------------------------------------------
step "Deployment complete"

# Build display URL
if [[ "$DOMAIN" == "localhost" || "$DOMAIN" == "127.0.0.1" ]]; then
  if [[ "$HOST_PORT" == "80" ]]; then
    DISPLAY_URL="http://localhost"
  else
    DISPLAY_URL="http://localhost:$HOST_PORT"
  fi
elif [[ "$RUN_HTTPS" == true ]]; then
  DISPLAY_URL="https://$DOMAIN"
else
  if [[ "$HOST_PORT" == "80" ]]; then
    DISPLAY_URL="http://$DOMAIN"
  else
    DISPLAY_URL="http://$DOMAIN:$HOST_PORT"
  fi
fi

echo ""
echo -e "  ${GREEN}Portal URL:   ${CYAN}${DISPLAY_URL}${NC}"
echo -e "  ${GREEN}Health check: ${CYAN}${DISPLAY_URL}/api/system/public${NC}"
echo ""

if [[ "$SEED" == true ]]; then
  echo "  Default accounts:"
  echo "    admin@cityu.edu        / admin12345   (Administrator)"
  echo "    coordinator@cityu.edu  / admin12345   (Coordinator)"
  echo "    reviewer@cityu.edu     / admin12345   (Reviewer)"
  echo "    student@cityu.edu      / admin12345   (Student)"
  echo ""
fi

echo "  Useful commands:"
printf "    %-34s %s\n" "View live logs:"        "docker compose logs -f app"
printf "    %-34s %s\n" "Open app shell:"        "docker exec -it rrp_app bash"
printf "    %-34s %s\n" "Run Artisan command:"   "docker exec -w /var/www/html rrp_app php artisan <cmd>"
printf "    %-34s %s\n" "Stop (keep data):"      "docker compose down"
printf "    %-34s %s\n" "Stop + wipe ALL data:"  "docker compose down -v  # DESTRUCTIVE"
echo ""
echo "  Configure email, SSO and other settings:"
printf "    %-34s %s\n" "Edit:"    "$ENV_FILE"
printf "    %-34s %s\n" "Reload:"  "docker exec -w /var/www/html rrp_app php artisan config:cache"
echo ""
