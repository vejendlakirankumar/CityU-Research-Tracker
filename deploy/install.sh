#!/usr/bin/env bash
# =============================================================================
# install.sh — Fresh bare-metal Ubuntu 22.04 installer for RRP v2
# =============================================================================
# Usage:
#   sudo bash install.sh [OPTIONS]
#
# Options:
#   --domain  DOMAIN   Public domain name (e.g. portal.cityu.edu)
#   --email   EMAIL    Admin email for Let's Encrypt + seed account
#   --skip-ssl         Skip TLS certificate provisioning
#   --dev              Install in development mode (sqlite, no ssl)
#
# Example:
#   sudo bash install.sh --domain portal.cityu.edu --email admin@cityu.edu
# =============================================================================
set -euo pipefail

# ---------- helpers -----------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
require() { command -v "$1" &>/dev/null || error "Required command not found: $1"; }

# ---------- defaults ----------------------------------------------------------
DOMAIN=""
ADMIN_EMAIL=""
SKIP_SSL=false
DEV_MODE=false
APP_DIR="/var/www/rrp"
APP_USER="rrp"
DB_NAME="rrp_production"
DB_USER="rrp_app"
DB_PASS=$(openssl rand -hex 24)
APP_KEY=""

# ---------- parse arguments ---------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)   DOMAIN="$2";       shift 2 ;;
    --email)    ADMIN_EMAIL="$2";  shift 2 ;;
    --skip-ssl) SKIP_SSL=true;     shift   ;;
    --dev)      DEV_MODE=true;     shift   ;;
    *) error "Unknown argument: $1" ;;
  esac
done

[[ $EUID -ne 0 ]] && error "This script must be run as root (sudo bash install.sh ...)"
[[ -z "$DOMAIN" && "$DEV_MODE" == false ]] && error "--domain is required unless --dev is set"

# Determine the script's own directory so we can reference sibling files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"   # parent of deploy/ == v2/ root

# ---------- 1. System packages ------------------------------------------------
info "Updating apt and installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl wget gnupg2 ca-certificates lsb-release \
  software-properties-common apt-transport-https unzip git supervisor \
  certbot python3-certbot-nginx acl

# PHP 8.4
info "Adding PHP 8.4 PPA..."
add-apt-repository -y ppa:ondrej/php
apt-get update -q
apt-get install -y -q php8.4 php8.4-fpm php8.4-cli php8.4-pgsql php8.4-redis \
  php8.4-mbstring php8.4-xml php8.4-curl php8.4-zip php8.4-gd php8.4-bcmath

# PostgreSQL 16
info "Installing PostgreSQL 16..."
if ! command -v psql &>/dev/null; then
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
    gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
  echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
    https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -q
  apt-get install -y -q postgresql-16
fi

# Redis 7
info "Installing Redis 7..."
if ! command -v redis-server &>/dev/null; then
  curl -fsSL https://packages.redis.io/gpg | \
    gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] \
    https://packages.redis.io/deb $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/redis.list
  apt-get update -q
  apt-get install -y -q redis
fi

# Nginx
info "Installing Nginx..."
apt-get install -y -q nginx

# Node 20
info "Installing Node 20..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -q nodejs
fi

# Composer
info "Installing Composer..."
if ! command -v composer &>/dev/null; then
  curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

# ---------- 2. Create system user and directory ------------------------------
info "Creating system user and app directory..."
if ! id -u "$APP_USER" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"
setfacl -R -m u:"$APP_USER":rwx "$APP_DIR"

# ---------- 3. Copy application files ----------------------------------------
info "Copying application files to $APP_DIR..."
rsync -a --exclude='vendor' --exclude='.env' --exclude='node_modules' \
  --exclude='storage/logs/*' --exclude='storage/framework/cache/*' \
  "$REPO_DIR/backend/"  "$APP_DIR/backend/"
rsync -a "$REPO_DIR/frontend/" "$APP_DIR/frontend/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---------- 4. Database setup -------------------------------------------------
info "Setting up PostgreSQL database..."
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';"
fi
if ! sudo -u postgres psql -lqt | cut -d '|' -f1 | grep -qw "$DB_NAME"; then
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi

# ---------- 5. Environment file -----------------------------------------------
info "Generating .env..."
APP_KEY=$(sudo -u "$APP_USER" php8.4 -r "echo 'base64:'.base64_encode(random_bytes(32));")
PUBLIC_URL="http://$DOMAIN"
[[ "$SKIP_SSL" == false && -n "$DOMAIN" ]] && PUBLIC_URL="https://$DOMAIN"

cat > "$APP_DIR/backend/.env" <<EOF
APP_NAME="Research Review Portal"
APP_ENV=production
APP_KEY=$APP_KEY
APP_DEBUG=false
APP_URL=$PUBLIC_URL

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=$DB_NAME
DB_USERNAME=$DB_USER
DB_PASSWORD=$DB_PASS

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

SANCTUM_STATEFUL_DOMAINS=$DOMAIN
SESSION_DOMAIN=$DOMAIN

MAIL_MAILER=log
MAIL_FROM_ADDRESS=noreply@$DOMAIN
MAIL_FROM_NAME="Research Review Portal"

LOG_CHANNEL=single
LOG_LEVEL=error
FILESYSTEM_DISK=local
EOF

chown "$APP_USER:$APP_USER" "$APP_DIR/backend/.env"
chmod 640 "$APP_DIR/backend/.env"

# ---------- 6. Composer dependencies -----------------------------------------
info "Installing Composer dependencies..."
sudo -u "$APP_USER" composer install --no-dev --optimize-autoloader \
  --no-interaction --working-dir="$APP_DIR/backend"

# ---------- 7. Frontend build -------------------------------------------------
info "Building React frontend..."
cd "$APP_DIR/frontend"
npm ci --silent
npm run build
rsync -a dist/ "$APP_DIR/frontend-dist/"
cd - >/dev/null

# ---------- 8. Database migrations and seed -----------------------------------
info "Running database migrations and seed..."
sudo -u "$APP_USER" php8.4 "$APP_DIR/backend/artisan" migrate --force
sudo -u "$APP_USER" php8.4 "$APP_DIR/backend/artisan" db:seed --force
sudo -u "$APP_USER" php8.4 "$APP_DIR/backend/artisan" storage:link
sudo -u "$APP_USER" php8.4 "$APP_DIR/backend/artisan" config:cache
sudo -u "$APP_USER" php8.4 "$APP_DIR/backend/artisan" route:cache
sudo -u "$APP_USER" php8.4 "$APP_DIR/backend/artisan" view:cache

# ---------- 9. PHP-FPM pool --------------------------------------------------
info "Configuring PHP-FPM pool..."
cat > /etc/php/8.4/fpm/pool.d/rrp.conf <<EOF
[rrp]
user  = $APP_USER
group = $APP_USER
listen = /run/php/php8.4-fpm-rrp.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 10
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 5
pm.max_requests = 500
EOF
systemctl restart php8.4-fpm

# ---------- 10. Nginx vhost --------------------------------------------------
info "Configuring Nginx vhost..."
DIST_DIR="$APP_DIR/frontend-dist"
FPM_SOCK="/run/php/php8.4-fpm-rrp.sock"
cat > /etc/nginx/sites-available/rrp <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    root $APP_DIR/backend/public;

    # React SPA
    location /app/ {
        alias $DIST_DIR/;
        try_files \$uri \$uri/ /app/index.html;
        expires 7d;
    }

    # Laravel API
    location /api/ {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }
    location /sanctum/ {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        fastcgi_pass unix:$FPM_SOCK;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
    }

    location ~ /\.ht { deny all; }
}
EOF

ln -sf /etc/nginx/sites-available/rrp /etc/nginx/sites-enabled/rrp
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---------- 11. Supervisor (queue worker) ------------------------------------
info "Configuring Supervisor..."
cat > /etc/supervisor/conf.d/rrp-worker.conf <<EOF
[program:rrp-worker]
process_name=%(program_name)s_%(process_num)02d
command=php8.4 $APP_DIR/backend/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=$APP_USER
numprocs=2
redirect_stderr=true
stdout_logfile=$APP_DIR/backend/storage/logs/worker.log
EOF
supervisorctl reread && supervisorctl update && supervisorctl start rrp-worker:*

# ---------- 12. Cron (scheduler) ---------------------------------------------
info "Installing cron job for Laravel scheduler..."
(crontab -u "$APP_USER" -l 2>/dev/null; \
  echo "* * * * * php8.4 $APP_DIR/backend/artisan schedule:run >> /dev/null 2>&1") \
  | crontab -u "$APP_USER" -

# ---------- 13. SSL -----------------------------------------------------------
if [[ "$SKIP_SSL" == false && -n "$DOMAIN" && -n "$ADMIN_EMAIL" ]]; then
  info "Obtaining Let's Encrypt certificate for $DOMAIN..."
  certbot --nginx -d "$DOMAIN" --email "$ADMIN_EMAIL" --agree-tos --non-interactive --redirect \
    || warn "Certbot failed. Run 'sudo certbot --nginx -d $DOMAIN' manually once DNS is live."
fi

# ---------- Done --------------------------------------------------------------
info "============================================================"
info " Installation complete!"
info ""
info " Portal URL : $PUBLIC_URL/app/"
info " API base   : $PUBLIC_URL/api/"
info ""
info " Default admin : admin@cityu.edu / admin12345"
info " CHANGE THIS PASSWORD IMMEDIATELY."
info ""
info " DB password saved in : $APP_DIR/backend/.env"
info "============================================================"
