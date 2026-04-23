#!/bin/sh
set -e

# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint: read Docker secrets into environment variables, then start services
# ─────────────────────────────────────────────────────────────────────────────

if [ "$SECRETS_FROM_FILES" = "true" ]; then
    for secret_file in /run/secrets/*; do
        [ -f "$secret_file" ] || continue
        varname=$(basename "$secret_file" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
        export "$varname"="$(cat "$secret_file")"
    done
fi

# Ensure storage directories exist and are writable
mkdir -p /var/www/html/storage/logs
mkdir -p /var/www/html/storage/framework/sessions
mkdir -p /var/www/html/storage/framework/views
mkdir -p /var/www/html/storage/framework/cache
mkdir -p /var/www/html/storage/app/public/org
mkdir -p /var/www/html/storage/backups
mkdir -p /var/www/html/bootstrap/cache

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 755 /var/www/html/storage /var/www/html/bootstrap/cache

# Write .env from environment variables (Laravel needs this file or the env vars exposed)
# In production, env vars are set directly; .env is only written in container context
if [ ! -f /var/www/html/.env ]; then
    cat > /var/www/html/.env <<EOF
APP_NAME="${APP_NAME:-Research Review Portal}"
APP_ENV=${APP_ENV:-production}
APP_KEY=${APP_KEY}
APP_DEBUG=${APP_DEBUG:-false}
APP_URL=${APP_URL:-http://localhost:8080}

LOG_CHANNEL=${LOG_CHANNEL:-stderr}
LOG_LEVEL=${LOG_LEVEL:-error}

DB_CONNECTION=pgsql
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE:-rrp_production}
DB_USERNAME=${DB_USERNAME:-rrp_app}
DB_PASSWORD=${DB_PASSWORD}
DB_SSLMODE=${DB_SSLMODE:-prefer}

BROADCAST_CONNECTION=reverb
CACHE_STORE=redis
QUEUE_CONNECTION=${QUEUE_CONNECTION:-redis}
SESSION_DRIVER=cookie
SESSION_LIFETIME=480

REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PASSWORD=${REDIS_PASSWORD:-null}
REDIS_PORT=${REDIS_PORT:-6379}

FILESYSTEM_DISK=${FILESYSTEM_DISK:-local}

SANCTUM_STATEFUL_DOMAINS=${SANCTUM_STATEFUL_DOMAINS:-localhost:8080}
SESSION_DOMAIN=${SESSION_DOMAIN:-localhost}

REVERB_APP_ID=${REVERB_APP_ID:-rrp-app}
REVERB_APP_KEY=${REVERB_APP_KEY:-rrp-key}
REVERB_APP_SECRET=${REVERB_APP_SECRET:-rrp-secret}
REVERB_HOST=${REVERB_HOST:-0.0.0.0}
REVERB_PORT=${REVERB_PORT:-8001}
EOF
fi

# Run migrations on startup (idempotent)
cd /var/www/html
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Running migrations..."
    su -s /bin/sh www-data -c "php artisan migrate --force --no-interaction"
fi

# Generate app key if not set
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "" ]; then
    echo "WARNING: APP_KEY is not set. Generating a temporary key (not suitable for production)."
    su -s /bin/sh www-data -c "php artisan key:generate --force"
fi

# Create storage symlink
su -s /bin/sh www-data -c "php artisan storage:link 2>/dev/null || true"

# Optimize for production
if [ "${APP_ENV}" = "production" ]; then
    su -s /bin/sh www-data -c "php artisan config:cache"
    su -s /bin/sh www-data -c "php artisan route:cache"
    # view:cache skipped — API-only app, no Blade views directory
fi

echo "Starting services..."

# If a command was passed (e.g., the queue worker), exec it directly instead of
# starting nginx. This allows the same image to serve as both the app container
# and the worker container — the worker overrides the default CMD via docker-compose.
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# Start PHP-FPM
php-fpm8.4 -D

# Start nginx in foreground
exec nginx -g 'daemon off;'
