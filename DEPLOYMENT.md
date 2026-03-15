# Deployment Guide — Research Review Portal

> **Goal:** Get the plugin running on a WordPress instance for local testing.  
> Three options are covered — choose whichever fits your machine.

---

## Option A — Local WP with Docker (recommended, no PHP install needed)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Steps

**1. Create a `docker-compose.yml` in any working folder** (outside this repo):

```yaml
version: '3.8'

services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wp
      MYSQL_PASSWORD: wp
    volumes:
      - db_data:/var/lib/mysql

  wordpress:
    image: wordpress:latest
    ports:
      - "8080:80"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wp
      WORDPRESS_DB_PASSWORD: wp
      WORDPRESS_DB_NAME: wordpress
    volumes:
      - wp_data:/var/www/html
      - ./plugins/research-review-portal:/var/www/html/wp-content/plugins/research-review-portal

volumes:
  db_data:
  wp_data:
```

**2. Copy the plugin into the volume-mapped folder:**

```powershell
# From your working folder (where docker-compose.yml lives)
New-Item -ItemType Directory -Force -Path plugins\research-review-portal
Copy-Item -Recurse "D:\Development\CityU-Research-Tracker\*" plugins\research-review-portal\
```

**3. Start the containers:**

```powershell
docker-compose up -d
```

**4. Run WordPress setup:**

Open http://localhost:8080 in your browser and complete the 5-minute WordPress install wizard (choose any site title, create an admin user).

**5. Activate the plugin:**

- Log in to http://localhost:8080/wp-admin
- Go to **Plugins → Installed Plugins**
- Find **Research Review Portal** and click **Activate**

**6. Fix file permissions** (so the plugin can write JSON data):

```powershell
docker-compose exec wordpress chmod -R 777 /var/www/html/wp-content/plugins/research-review-portal/data
```

**7. Create the portal page:**

- Go to **Pages → Add New**
- Title: `Research Portal`
- Body: `[research_review_portal]` (switch to Text / Code editor mode)
- Click **Publish**

**8. Open the portal:**

- http://localhost:8080/research-portal/?portal=1

**To stop:**
```powershell
docker-compose down
```

---

## Option B — Local WP with LocalWP (GUI, easiest)

### Prerequisites
- Download and install [LocalWP](https://localwp.com/) (free)

### Steps

1. Open **LocalWP** → click **+ Create a new site**
2. Site name: `CityU Research Portal` → continue through defaults (PHP 8.1, MySQL 8.0, Nginx/Apache)
3. Note the site path shown in LocalWP (e.g. `C:\Users\YourName\Local Sites\cityu-research-portal`)
4. **Copy the plugin** into the plugins folder:

```powershell
$localSite = "C:\Users\YourName\Local Sites\cityu-research-portal\app\public\wp-content\plugins"
Copy-Item -Recurse "D:\Development\CityU-Research-Tracker" "$localSite\research-review-portal"
```

5. Click **Start site** in LocalWP
6. Click **WP Admin** → log in → **Plugins → Activate** Research Review Portal
7. Go to **Pages → Add New**, add title `Research Portal`, body `[research_review_portal]`, Publish
8. Click **Open site** or browse to the local URL shown in LocalWP, then append `/research-portal/?portal=1`

---

## Option C — GitHub Codespace (no local setup)

### Prerequisites
- GitHub account with access to this repository
- The repo pushed to GitHub

### Steps

1. On GitHub, open the repository → click **Code → Codespaces → Create codespace on main**

2. Once the Codespace terminal opens, install Docker-in-Docker or use the pre-installed PHP and Apache:

```bash
# Install WordPress CLI
curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
sudo mv wp-cli.phar /usr/local/bin/wp

# Install Apache + PHP + MySQL
sudo apt-get update -qq
sudo apt-get install -y apache2 php php-mysql php-curl php-mbstring php-xml libapache2-mod-php mysql-server

# Start services
sudo service mysql start
sudo service apache2 start

# Create WordPress database
sudo mysql -e "CREATE DATABASE wordpress; CREATE USER 'wp'@'localhost' IDENTIFIED BY 'wp'; GRANT ALL ON wordpress.* TO 'wp'@'localhost';"
```

3. **Download and install WordPress:**

```bash
cd /var/www/html
sudo wp core download --allow-root
sudo wp config create --dbname=wordpress --dbuser=wp --dbpass=wp --allow-root
sudo wp core install --url=localhost --title="CityU Research Portal" \
  --admin_user=admin --admin_password=admin123 --admin_email=admin@test.com --allow-root
```

4. **Link the plugin:**

```bash
sudo ln -s /workspaces/<repo-name> /var/www/html/wp-content/plugins/research-review-portal
sudo chmod -R 777 /var/www/html/wp-content/plugins/research-review-portal/data
sudo wp plugin activate research-review-portal --allow-root
```

5. **Create the portal page:**

```bash
sudo wp post create --post_type=page --post_title="Research Portal" \
  --post_content='[research_review_portal]' --post_status=publish --allow-root
```

6. In the Codespace **Ports** tab, forward port **80** and open the forwarded URL → append `/research-portal/?portal=1`

---

## Post-install: Create test users

Create one user per role to test the full workflow:

**In WP Admin → Users → Add New:**

| Display name    | Email                        | Role              |
|-----------------|------------------------------|-------------------|
| Test Student    | student@test.com             | RRP Student       |
| Test Reviewer   | reviewer@test.com            | RRP Reviewer      |
| Test Coordinator| coordinator@test.com         | RRP Coordinator   |
| Test Admin      | rrpadmin@test.com            | RRP Admin         |

Or via WP-CLI (adjust `--url` as needed):

```bash
wp user create student student@test.com --role=rrp_student --user_pass=test123 --allow-root
wp user create reviewer reviewer@test.com --role=rrp_reviewer --user_pass=test123 --allow-root
wp user create coordinator coordinator@test.com --role=rrp_coordinator --user_pass=test123 --allow-root
wp user create rrpadmin rrpadmin@test.com --role=rrp_admin --user_pass=test123 --allow-root
```

---

## Quick smoke test

| Step | URL / action | Expected result |
|------|-------------|-----------------|
| 1 | `/wp-json/research-portal/v1/health` | `{"ok":true}` |
| 2 | Log in as `student@test.com`, open portal | Submission form visible |
| 3 | Submit a conference abstract | Confirmation with reference ID |
| 4 | Log in as `reviewer@test.com`, open **Reviewer Dashboard** | Assigned submission listed |
| 5 | Click **Review** on assignment | Detail view with "Record Your Decision" form |
| 6 | Log in as `rrpadmin@test.com`, open **Dashboard** | All submissions listed with Details/Timeline buttons |

---

## Configuration

The plugin reads from `data/config.json` (inside the plugin folder). Key settings:

| Key | Purpose | Default |
|-----|---------|---------|
| `stageDueDays.<type>` | Days allowed per stage before overdue | 7 |
| `reviewerPools.<type>.reviewerIds` | Pool of reviewer IDs for auto-assignment | see file |
| `reviewerPools.<type>.assignmentMode` | `random` or `round_robin` | `random` |
| `stageRequirements.<type>.<stage>.requiredCount` | Reviewers required per stage | varies |

Edit via the portal's **Config** API (`PUT /wp-json/research-portal/v1/config`) or directly in the JSON file when the site is stopped.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| REST API returns 401 on all endpoints | Ensure WordPress permalinks are set to **Post name** (Settings → Permalinks → Save) |
| JSON write errors / submissions not saving | `chmod -R 777 data/` inside the plugin folder |
| "Portal API not configured" on page | The shortcode page was published but plugin is not activated — activate it in WP Admin → Plugins |
| Roles not appearing in Add User dropdown | Deactivate and re-activate the plugin once (role registration runs on activation hook) |
| File uploads silently fail | Check `data/uploads/` exists and is writable; max upload size in `php.ini` must be ≥ 2 MB |
| URL changes to `localhost` when accessing via public DNS / Azure hostname | WordPress was installed with `--url=http://localhost`. Run `scripts/set-public-url.sh` — see **Exposing to the internet / Azure public DNS** section below |

---

## Option D — WSL Ubuntu 22.04 LTS (independent VM / local WSL)

> **Can I follow Option C instead?**  
> Option C is written for GitHub Codespaces. The commands are ~90% the same, but WSL differs in three ways: the repo lives on your Windows drive (accessible at `/mnt/d/…`), there is no "Ports" tab — you just open `http://localhost` in your Windows browser, and MySQL setup uses `sudo mysql` directly. Use the dedicated steps below to avoid confusion.

### Prerequisites (Windows side)
- WSL 2 with Ubuntu 22.04 installed (`wsl --install -d Ubuntu-22.04`)
- The repo present at `D:\Development\CityU-Research-Tracker` on Windows

---

### One-shot install script

Copy the block below, paste it into your WSL terminal, and run it.  
Everything will be installed and WordPress will be fully configured automatically.

```bash
#!/usr/bin/env bash
set -euo pipefail

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
curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
sudo mv wp-cli.phar /usr/local/bin/wp

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
sudo rm -rf /var/www/html/wp-includes  # remove default Apache page if WP already partially there
cd /var/www/html
sudo wp core download --allow-root --quiet

sudo wp config create \
  --dbname=wordpress \
  --dbuser=wp \
  --dbpass=wp_test_pass \
  --dbhost=localhost \
  --allow-root

sudo wp core install \
  --url=http://localhost \
  --title="CityU Research Portal" \
  --admin_user=admin \
  --admin_password=Admin1234! \
  --admin_email=admin@cityu-test.local \
  --skip-email \
  --allow-root

# ── 6. Permalinks (required for REST API) ────────────────────────────────────
echo "==> Enabling pretty permalinks..."
sudo wp rewrite structure '/%postname%/' --allow-root
sudo wp rewrite flush --allow-root

# Enable mod_rewrite
sudo a2enmod rewrite
sudo sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf
sudo service apache2 restart

# ── 7. Plugin ────────────────────────────────────────────────────────────────
PLUGIN_DIR="/var/www/html/wp-content/plugins/research-review-portal"
REPO_WIN="/mnt/d/Development/CityU-Research-Tracker"

echo "==> Linking plugin from Windows drive..."
if [ ! -d "$REPO_WIN" ]; then
  echo "ERROR: Repo not found at $REPO_WIN"
  echo "       Adjust REPO_WIN in this script to match your Windows path."
  exit 1
fi

sudo ln -sfn "$REPO_WIN" "$PLUGIN_DIR"
sudo chmod -R 777 "$PLUGIN_DIR/data"

sudo wp plugin activate research-review-portal --allow-root

# ── 8. Portal page ───────────────────────────────────────────────────────────
echo "==> Creating portal page..."
PAGE_ID=$(sudo wp post create \
  --post_type=page \
  --post_title="Research Portal" \
  --post_content='[research_review_portal]' \
  --post_status=publish \
  --porcelain \
  --allow-root)
sudo wp post update "$PAGE_ID" --post_name=research-portal --allow-root

# Set as static front page (required — without this WP shows "Latest Posts")
sudo wp option update show_on_front 'page' --allow-root
sudo wp option update page_on_front "$PAGE_ID" --allow-root

# ── 9. Test users ────────────────────────────────────────────────────────────
echo "==> Creating test users..."
sudo wp user create student    student@test.com      --role=rrp_student      --user_pass=test123 --allow-root 2>/dev/null || true
sudo wp user create reviewer   reviewer@test.com     --role=rrp_reviewer     --user_pass=test123 --allow-root 2>/dev/null || true
sudo wp user create coordinator coordinator@test.com --role=rrp_coordinator  --user_pass=test123 --allow-root 2>/dev/null || true
sudo wp user create rrpadmin   rrpadmin@test.com     --role=rrp_admin        --user_pass=test123 --allow-root 2>/dev/null || true

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  Install complete!"
echo "============================================================"
echo "  Portal:    http://localhost/research-portal/?portal=1"
echo "  WP Admin:  http://localhost/wp-admin"
echo "             admin / Admin1234!"
echo ""
echo "  Test logins (all passwords: test123)"
echo "    student@test.com       rrp_student"
echo "    reviewer@test.com      rrp_reviewer"
echo "    coordinator@test.com   rrp_coordinator"
echo "    rrpadmin@test.com      rrp_admin"
echo ""
echo "  Health check:"
echo "    curl http://localhost/wp-json/research-portal/v1/health"
echo "============================================================"
```

---

### How to run the script

The script is already saved in this repo at `scripts/install-wsl.sh`.

1. Open your **WSL Ubuntu 22.04** terminal
2. Navigate to the repo (accessible from WSL via the Windows drive):

```bash
cd /mnt/d/Development/CityU-Research-Tracker
chmod +x scripts/install-wsl.sh
./scripts/install-wsl.sh
```

Alternatively, copy-paste the block above into `~/install-portal.sh` and run it from there.

3. When it finishes, open **http://localhost/research-portal/?portal=1** in your Windows browser.

---

### If the repo is NOT on D drive

Edit the `REPO_WIN` line near the top of the script before running:

```bash
REPO_WIN="/mnt/c/Users/YourName/path/to/CityU-Research-Tracker"
```

Or clone directly from GitHub inside WSL (no Windows path needed):

```bash
# Alternative: clone inside WSL instead of linking
sudo git clone https://github.com/<your-org>/CityU-Research-Tracker \
  /var/www/html/wp-content/plugins/research-review-portal
sudo chmod -R 777 /var/www/html/wp-content/plugins/research-review-portal/data
sudo wp plugin activate research-review-portal --allow-root
```

---

### Day-to-day commands (WSL)

| Task | Command |
|------|---------|
| Start Apache + MySQL | `sudo service apache2 start && sudo service mysql start` |
| Stop all | `sudo service apache2 stop && sudo service mysql stop` |
| Tail PHP error log | `sudo tail -f /var/log/apache2/error.log` |
| Re-run permissions fix | `sudo chmod -R 777 /var/www/html/wp-content/plugins/research-review-portal/data` |
| Reset to fresh WordPress | `sudo wp db reset --yes --allow-root && ~/install-portal.sh` |

---

## Exposing to the internet / Azure public DNS

WordPress stores its own URL in the database (`siteurl` and `home` options). When the site
was first installed with `--url=http://localhost`, every request coming in on a public
hostname gets redirected back to `localhost`, making the site unreachable from the internet.

### One-time fix for an existing install

From inside WSL on the Azure VM, run the helper script:

```bash
cd /mnt/d/Development/CityU-Research-Tracker
chmod +x scripts/set-public-url.sh
./scripts/set-public-url.sh http://rcgapimtest.eastus2.cloudapp.azure.com
```

The script:
1. Updates `siteurl` and `home` in the WordPress database
2. Writes `WP_HOME` and `WP_SITEURL` PHP constants into `wp-config.php` — these
   take priority over the database, so a DB reset cannot silently revert the URL
3. Flushes WordPress rewrite rules

### Fresh install with the correct URL from the start

Pass `WP_URL` as an environment variable before running the install script:

```bash
WP_URL="http://rcgapimtest.eastus2.cloudapp.azure.com" ./scripts/install-wsl.sh
```

### Azure VM / NSG checklist

Before the site is reachable from the internet, confirm the following in the Azure portal:

| Check | Where |
|-------|-------|
| Inbound NSG rule allows **TCP port 80** from any source | VM → Networking → Inbound port rules |
| (Optional) Inbound NSG rule allows **TCP port 443** if you add HTTPS later | same |
| Public IP is **Static** (so the DNS name doesn't change after a VM restart) | VM → Overview → Public IP address |
| DNS label matches `rcgapimtest.eastus2.cloudapp.azure.com` | Public IP → Configuration → DNS name label |

### Adding HTTPS (optional but recommended)

Once the site is reachable over HTTP, install Certbot to get a free Let's Encrypt certificate:

```bash
sudo apt-get install -y certbot python3-certbot-apache
sudo certbot --apache -d rcgapimtest.eastus2.cloudapp.azure.com
# Then update the site URL to use https://
./scripts/set-public-url.sh https://rcgapimtest.eastus2.cloudapp.azure.com
```
