#!/usr/bin/env bash
# ================================================================
# CityU Research Review Portal — one-time WordPress initialisation
#
# Run ONCE after containers are started for the first time:
#   make init
#   — or —
#   docker compose exec wordpress bash /usr/local/bin/docker-init.sh
#
# Safe to re-run: existing WordPress installs are detected and
# skipped; only the URL is updated.
# ================================================================
set -euo pipefail

WP_BIN=/usr/local/bin/wp
WP_DIR=/var/www/html
PLUGIN=research-review-portal

WP_URL="${WP_URL:-http://localhost:8080}"
WP_ADMIN_USER="${WP_ADMIN_USER:-admin}"
WP_ADMIN_PASSWORD="${WP_ADMIN_PASSWORD:-Admin1234!}"
WP_ADMIN_EMAIL="${WP_ADMIN_EMAIL:-admin@cityu-test.local}"

# ── Wait for WordPress files to exist (written by WP entrypoint) ────
echo "==> Waiting for WordPress core files..."
WAIT=0
until [ -f "$WP_DIR/wp-login.php" ]; do
  sleep 3
  WAIT=$((WAIT+3))
  if [ "$WAIT" -gt 120 ]; then
    echo "ERROR: WordPress files not found after 120 s. Is the container running?"
    exit 1
  fi
done

# ── Install WordPress if not already installed ───────────────────────
if ! $WP_BIN core is-installed --path="$WP_DIR" --allow-root 2>/dev/null; then
  echo "==> Installing WordPress core..."
  $WP_BIN core install \
    --path="$WP_DIR" \
    --url="$WP_URL" \
    --title='CityU Research Portal' \
    --admin_user="$WP_ADMIN_USER" \
    --admin_password="$WP_ADMIN_PASSWORD" \
    --admin_email="$WP_ADMIN_EMAIL" \
    --skip-email \
    --allow-root
  echo "    WordPress installed."
else
  echo "==> WordPress already installed — updating site URL to: $WP_URL"
  $WP_BIN option update siteurl "$WP_URL" --path="$WP_DIR" --allow-root
  $WP_BIN option update home    "$WP_URL" --path="$WP_DIR" --allow-root
fi

# ── Pretty permalinks (required for WP REST API) ─────────────────────
echo "==> Enabling pretty permalinks..."
$WP_BIN rewrite structure '/%postname%/' --path="$WP_DIR" --allow-root
$WP_BIN rewrite flush                    --path="$WP_DIR" --allow-root

# ── Activate plugin ──────────────────────────────────────────────────
PLUGIN_DIR="$WP_DIR/wp-content/plugins/$PLUGIN"
if [ -d "$PLUGIN_DIR" ]; then
  echo "==> Activating plugin..."
  $WP_BIN plugin activate "$PLUGIN" --path="$WP_DIR" --allow-root
  echo "    Plugin activated."
else
  echo "    WARNING: Plugin not found at $PLUGIN_DIR"
  echo "             Check that the bind mount in docker-compose.yml is correct."
fi

# ── Create the portal page if it doesn't exist ───────────────────────
PAGE_ID=$($WP_BIN post list \
  --path="$WP_DIR" \
  --post_type=page \
  --name=research-portal \
  --format=ids \
  --allow-root 2>/dev/null || true)

if [ -z "$PAGE_ID" ]; then
  echo "==> Creating portal page..."
  NEW_ID=$($WP_BIN post create \
    --path="$WP_DIR" \
    --post_type=page \
    --post_title='Research Portal' \
    --post_name='research-portal' \
    --post_status=publish \
    --post_content='[research_review_portal]' \
    --porcelain \
    --allow-root)
  $WP_BIN option update show_on_front 'page'    --path="$WP_DIR" --allow-root
  $WP_BIN option update page_on_front "$NEW_ID" --path="$WP_DIR" --allow-root
  echo "    Portal page created (ID: $NEW_ID) and set as front page."
else
  echo "==> Portal page already exists (ID: $PAGE_ID)."
fi

# ── Data directory permissions ────────────────────────────────────────
# The data/ folder inside the plugin stores JSON + uploads.
# Apache (www-data) must be able to write to it.
DATA_DIR="$PLUGIN_DIR/data"
if [ -d "$DATA_DIR" ]; then
  echo "==> Fixing data directory permissions..."
  chown -R www-data:www-data "$DATA_DIR" 2>/dev/null \
    || chmod -R 777 "$DATA_DIR" \
    || echo "    (could not set permissions — bind mount may control this)"
fi

echo ""
echo "================================================================"
echo "  Setup complete!"
echo "  Portal: $WP_URL"
echo "  Admin:  $WP_URL/wp-admin"
echo "  Login:  $WP_ADMIN_USER / $WP_ADMIN_PASSWORD"
echo "================================================================"
