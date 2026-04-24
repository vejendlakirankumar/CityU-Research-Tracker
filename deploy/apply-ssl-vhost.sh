#!/bin/bash
set -e
DOMAIN="${1:-rcgapimtest.eastus2.cloudapp.azure.com}"
PROXY_PORT="${2:-8080}"
SCRIPT_DIR="$(dirname "$0")"

sed -e "s/PORTAL_DOMAIN/$DOMAIN/g" -e "s/PROXY_PORT/$PROXY_PORT/g" \
    "$SCRIPT_DIR/nginx-vhost.conf" > /etc/nginx/sites-available/rrp-v2

ln -sf /etc/nginx/sites-available/rrp-v2 /etc/nginx/sites-enabled/rrp-v2
[ -L /etc/nginx/sites-enabled/default ] && rm /etc/nginx/sites-enabled/default || true

nginx -t
service nginx reload
echo "==> SSL vhost applied for $DOMAIN (proxy -> 127.0.0.1:$PROXY_PORT)"
