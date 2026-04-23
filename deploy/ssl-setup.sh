#!/bin/bash
# =============================================================================
# deploy/ssl-setup.sh
# Obtain a Let's Encrypt TLS certificate for the RRP v2 portal and configure
# Nginx to use it.
#
# Usage (run as root or with sudo):
#   sudo bash ssl-setup.sh <domain> [email]
#
# Examples:
#   sudo bash ssl-setup.sh portal.cityu.edu admin@cityu.edu
#
# Requirements:
#   - Nginx installed and running (the HTTP vhost must already be in place)
#   - Port 80 open in the firewall so Let's Encrypt can reach the ACME challenge
#   - The domain DNS A-record must point to this server's public IP
# =============================================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-webmaster@${DOMAIN}}"
PROXY_PORT="${3:-8080}"  # port Docker container is bound to on the host
WEBROOT="/var/www/letsencrypt"
VHOST_SOURCE="$(dirname "$0")/nginx-vhost.conf"
VHOST_DEST="/etc/nginx/sites-available/rrp-v2"
VHOST_LINK="/etc/nginx/sites-enabled/rrp-v2"

# ── Pre-flight ────────────────────────────────────────────────────────────────
if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain> [email]"
    exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (or with sudo)."
    exit 1
fi

echo "==> Domain   : $DOMAIN"
echo "==> Email    : $EMAIL"
echo "==> Webroot  : $WEBROOT"

# ── Install dependencies ──────────────────────────────────────────────────────
echo ""
echo "==> Installing certbot and python3-certbot-nginx …"
apt-get update -q
apt-get install -y -q certbot python3-certbot-nginx nginx

# ── Create webroot for ACME challenge ────────────────────────────────────────
mkdir -p "$WEBROOT"
chown www-data:www-data "$WEBROOT"

# ── Deploy the Nginx vhost (HTTP-only first so certbot can do the challenge) ──
if [ ! -f "$VHOST_SOURCE" ]; then
    echo "ERROR: nginx-vhost.conf not found at $VHOST_SOURCE"
    echo "       Copy it here or run this script from the deploy/ directory."
    exit 1
fi

echo "==> Installing Nginx vhost …"
sed -e "s/PORTAL_DOMAIN/$DOMAIN/g" -e "s/PROXY_PORT/$PROXY_PORT/g" "$VHOST_SOURCE" > "$VHOST_DEST"
ln -sf "$VHOST_DEST" "$VHOST_LINK"

# Remove default site if it conflicts on port 80
[ -L /etc/nginx/sites-enabled/default ] && rm /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

# ── Obtain certificate ────────────────────────────────────────────────────────
echo ""
echo "==> Obtaining Let's Encrypt certificate for $DOMAIN …"
certbot certonly \
    --webroot \
    --webroot-path "$WEBROOT" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN"

# ── Reload Nginx with SSL config ──────────────────────────────────────────────
echo "==> Reloading Nginx with TLS …"
nginx -t
systemctl reload nginx

# ── Cron auto-renewal ─────────────────────────────────────────────────────────
CRON_JOB="0 3 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'"
CRON_FILE="/etc/cron.d/certbot-renew-rrp"
if [ ! -f "$CRON_FILE" ]; then
    echo "==> Installing auto-renewal cron job …"
    echo "$CRON_JOB" > "$CRON_FILE"
    chmod 644 "$CRON_FILE"
else
    echo "==> Auto-renewal cron job already exists — skipping."
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " SSL setup complete!"
echo ""
echo " Certificate : /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo " Private key : /etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo " Auto-renewal: $CRON_FILE (runs at 03:00 daily)"
echo " Nginx vhost : $VHOST_DEST"
echo ""
echo " Verify at  : https://$DOMAIN/app/"
echo " ACME test  : certbot renew --dry-run"
echo "============================================================"
