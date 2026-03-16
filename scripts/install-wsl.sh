#!/usr/bin/env bash
# ============================================================
# Research Review Portal — WSL / Ubuntu 22.04 install script
# Usage: chmod +x scripts/install-wsl.sh && ./scripts/install-wsl.sh
#
# Set WP_URL to the public hostname before running on a server:
#   WP_URL="http://your-server.example.com" ./scripts/install-wsl.sh
#
# Prefer Docker? See DEPLOYMENT.md Option A.
# ============================================================
set -euo pipefail

# Auto-detect repo root relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_WIN="$(dirname "$SCRIPT_DIR")"

WP_ADMIN_PASS='Admin1234!'   # single quotes required — bash expands ! in double quotes
# Override WP_URL before running this script to set a public hostname:
#   WP_URL="http://rcgapimtest.eastus2.cloudapp.azure.com" ./scripts/install-wsl.sh
WP_URL="${WP_URL:-http://localhost}"

# ── 1. System packages ────────────────────────────────────────────────────────
echo "==> Installing Apache, PHP 8.1, MySQL, and utilities..."
sudo apt-get update -qq
sudo apt-get install -y \
  apache2 \
  php8.1 php8.1-mysql php8.1-curl php8.1-mbstring php8.1-xml \
  php8.1-zip php8.1-gd libapache2-mod-php8.1 \
  mysql-server \
  curl unzip

# ── 2. WP-CLI ────────────────────────────────────────────────────────────────
echo "==> Installing WP-CLI..."
if ! command -v wp &>/dev/null; then
  curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
  chmod +x wp-cli.phar
  sudo mv wp-cli.phar /usr/local/bin/wp
fi

# ── 3. Services ──────────────────────────────────────────────────────────────
echo "==> Starting MySQL and Apache..."
sudo service mysql start
sudo service apache2 start

# ── 4. MySQL database ────────────────────────────────────────────────────────
echo "==> Creating WordPress database and user..."
sudo mysql <<'SQL'
CREATE DATABASE IF NOT EXISTS wordpress CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'wp'@'localhost' IDENTIFIED BY 'wp_test_pass';
GRANT ALL PRIVILEGES ON wordpress.* TO 'wp'@'localhost';
FLUSH PRIVILEGES;
SQL

# ── 5. WordPress core ────────────────────────────────────────────────────────
echo "==> Downloading WordPress..."
# Clear the webroot so wp core download doesn't complain about existing files
sudo find /var/www/html -mindepth 1 -delete
cd /var/www/html
sudo wp core download --allow-root --quiet

# --force overwrites wp-config.php if the script is run a second time
sudo wp config create \
  --dbname=wordpress \
  --dbuser=wp \
  --dbpass=wp_test_pass \
  --dbhost=localhost \
  --force \
  --allow-root

# Lock the URL in wp-config.php so the database value can never silently revert
# to localhost (e.g. after a DB reset or import of a localhost backup).
echo "==> Locking site URL in wp-config.php..."
sudo wp config set WP_HOME    "$WP_URL" --type=constant --path=/var/www/html --allow-root
sudo wp config set WP_SITEURL "$WP_URL" --type=constant --path=/var/www/html --allow-root

# NOTE: WP_ADMIN_PASS must be single-quoted when passed to wp core install
# because bash expands '!' in double quotes (history expansion → "event not found" error)
sudo wp core install \
  --url="$WP_URL" \
  --title='CityU Research Portal' \
  --admin_user=admin \
  --admin_password="$WP_ADMIN_PASS" \
  --admin_email=admin@cityu-test.local \
  --skip-email \
  --allow-root

# ── 6. Permalinks (required for REST API) ────────────────────────────────────
echo "==> Enabling pretty permalinks..."
sudo wp rewrite structure '/%postname%/' --allow-root
sudo wp rewrite flush --allow-root

# Write .htaccess manually — wp rewrite flush --hard requires Apache to already
# be configured, so manual creation is more reliable on a fresh install.
sudo tee /var/www/html/.htaccess > /dev/null << 'HTACCESS'
# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress
HTACCESS
sudo chown www-data:www-data /var/www/html/.htaccess
sudo chmod 644 /var/www/html/.htaccess

sudo a2enmod rewrite
# Allow .htaccess overrides in /var/www/html
sudo sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf
# Also ensure the vhost itself has a Directory block with AllowOverride All
sudo sed -i '/<\/VirtualHost>/i\\t<Directory \/var\/www\/html>\n\t\tAllowOverride All\n\t\tRequire all granted\n\t<\/Directory>' /etc/apache2/sites-enabled/000-default.conf
sudo service apache2 restart

# ── 7. Plugin ────────────────────────────────────────────────────────────────
PLUGIN_DIR="/var/www/html/wp-content/plugins/research-review-portal"

echo "==> Linking plugin from: $REPO_WIN"
if [ ! -d "$REPO_WIN" ]; then
  echo ""
  echo "ERROR: Repo not found at $REPO_WIN"
  echo "       Run this script from anywhere inside the cloned repository,"
  echo "       or set REPO_WIN manually: REPO_WIN=/path/to/repo ./scripts/install-wsl.sh"
  echo "       Alternatively, use Docker: see DEPLOYMENT.md Option A."
  exit 1
fi

sudo ln -sfn "$REPO_WIN" "$PLUGIN_DIR"
sudo chmod -R 777 "$PLUGIN_DIR/data"
sudo wp plugin activate research-review-portal --allow-root

# ── 8. Clean up default WordPress content ────────────────────────────────────
echo "==> Removing default WordPress content..."
# Delete Hello World post and Sample Page (if they exist)
sudo wp post delete 1 --force --allow-root 2>/dev/null || true
sudo wp post delete 2 --force --allow-root 2>/dev/null || true

# ── 9. Portal home page ───────────────────────────────────────────────────────
echo "==> Creating portal home page..."
EXISTING=$(sudo wp post list --post_type=page --post_status=publish \
  --fields=ID --format=csv --name=research-portal --allow-root 2>/dev/null | tail -1)

if [ -z "$EXISTING" ] || [ "$EXISTING" = "ID" ]; then
  PAGE_ID=$(sudo wp post create \
    --post_type=page \
    --post_title="Research Portal" \
    --post_content='[research_review_portal]' \
    --post_status=publish \
    --post_name=research-portal \
    --porcelain \
    --allow-root)
  echo "   Created page ID $PAGE_ID"
else
  PAGE_ID="$EXISTING"
  echo "   Page already exists (ID $PAGE_ID), skipping creation."
fi

# Set static front page to the portal page
echo "==> Setting portal page as static front page..."
sudo wp option update show_on_front 'page' --allow-root
sudo wp option update page_on_front "$PAGE_ID" --allow-root
echo "   Front page set to page ID $PAGE_ID"

# ── 10. Test users ────────────────────────────────────────────────────────────
echo "==> Creating test users (password: test123)..."
sudo wp user create student      student@test.com      --role=rrp_student      --user_pass=test123 --allow-root 2>/dev/null || echo "   student already exists"
sudo wp user create reviewer     reviewer@test.com     --role=rrp_reviewer     --user_pass=test123 --allow-root 2>/dev/null || echo "   reviewer already exists"
sudo wp user create coordinator  coordinator@test.com  --role=rrp_coordinator  --user_pass=test123 --allow-root 2>/dev/null || echo "   coordinator already exists"
sudo wp user create rrpadmin     rrpadmin@test.com     --role=rrp_admin        --user_pass=test123 --allow-root 2>/dev/null || echo "   rrpadmin already exists"

# ── 11. Smoke test ───────────────────────────────────────────────────────────
echo ""
echo "==> Running health check..."
sleep 1
HEALTH=$(curl -s "$WP_URL/wp-json/research-portal/v1/health" 2>/dev/null || echo "unreachable")
echo "   Response: $HEALTH"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  Install complete!"
echo "============================================================"
echo "  Portal:    $WP_URL/research-portal/?portal=1"
echo "  WP Admin:  $WP_URL/wp-admin"
echo "             admin / $WP_ADMIN_PASS"
echo ""
echo "  Test logins (password: test123)"
echo "    student@test.com       — rrp_student"
echo "    reviewer@test.com      — rrp_reviewer"
echo "    coordinator@test.com   — rrp_coordinator"
echo "    rrpadmin@test.com      — rrp_admin"
echo ""
echo "  Tail logs:   sudo tail -f /var/log/apache2/error.log"
echo "  Start/stop:  sudo service apache2 {start|stop}"
echo "               sudo service mysql {start|stop}"
echo "============================================================"
