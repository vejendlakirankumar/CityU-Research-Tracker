#!/usr/bin/env bash
# ============================================================
# Research Review Portal — Set / change the WordPress site URL
#
# Run this once to switch the WordPress install from localhost
# to a public DNS name (e.g. an Azure public IP or hostname).
#
# Usage (from WSL):
#   chmod +x scripts/set-public-url.sh
#   ./scripts/set-public-url.sh http://your-portal.example.com
#
# What this script does:
#   1. Updates siteurl + home in the WordPress database
#   2. Writes WP_HOME and WP_SITEURL constants into wp-config.php
#      (config-file values override the DB, so a DB reset can't
#      silently revert the URL back to localhost)
#   3. Flushes WordPress rewrite rules
# ============================================================
set -euo pipefail

WP_PATH="/var/www/html"
NEW_URL="${1:-}"

if [ -z "$NEW_URL" ]; then
  echo "Usage:   $0 <new-url>"
  echo "Example: $0 http://your-portal.example.com"
  exit 1
fi

# Strip any trailing slash so URLs stay consistent
NEW_URL="${NEW_URL%/}"

echo "==> Updating WordPress site URL to: $NEW_URL"

# ── 1. Update the database options ───────────────────────────────────────────
echo "    Updating database options (siteurl + home)..."
sudo wp option update siteurl "$NEW_URL" --path="$WP_PATH" --allow-root
sudo wp option update home    "$NEW_URL" --path="$WP_PATH" --allow-root

# ── 2. Lock URL in wp-config.php ─────────────────────────────────────────────
# wp config set adds/overwrites define() constants directly in wp-config.php.
# PHP constants defined here take priority over database values, so the URL
# stays correct even after `wp db reset` or importing a database backup.
echo "    Writing WP_HOME and WP_SITEURL to wp-config.php..."
sudo wp config set WP_HOME    "$NEW_URL" --type=constant --path="$WP_PATH" --allow-root
sudo wp config set WP_SITEURL "$NEW_URL" --type=constant --path="$WP_PATH" --allow-root

# ── 3. Flush rewrite rules ───────────────────────────────────────────────────
echo "    Flushing rewrite rules..."
sudo wp rewrite flush --path="$WP_PATH" --allow-root

echo ""
echo "============================================================"
echo "  Site URL updated successfully!"
echo ""
echo "  Portal:   $NEW_URL/research-portal/?portal=1"
echo "  WP Admin: $NEW_URL/wp-admin"
echo ""
echo "  If you still see 'localhost' links:"
echo "    1. Clear your browser cache and cookies"
echo "    2. Check that Apache is listening on port 80 for this hostname"
echo "    3. Make sure port 80 is open in the Azure NSG for the VM"
echo "============================================================"
