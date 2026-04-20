# Deployment Guide — CityU Research Review Portal

> **Current production server:** `<public url of the portal>` — Ubuntu 22.04, Apache 2.4, PHP 8.1, MySQL 8.0, WordPress 6.7
>
> **Portal URL:** `http://<public url of the portal>/research-portal/?portal=1`
> **WP Admin:** `http://<public url of the portal>/wp-admin`

---

## Table of Contents

1. [Option A — Docker (Local Dev / Staging)](#1-option-a--docker-local-dev--staging)
2. [Option B — Bare-metal Ubuntu VM (Production)](#2-option-b--bare-metal-ubuntu-vm-production)
3. [Deploying Code Changes to an Existing Server](#3-deploying-code-changes-to-an-existing-server)
4. [Changing the Public URL](#4-changing-the-public-url)
5. [Enabling HTTPS with Lets Encrypt](#5-enabling-https-with-lets-encrypt)
6. [Microsoft Entra ID SSO Setup](#6-microsoft-entra-id-sso-setup)
7. [Database Reference](#7-database-reference)
8. [WordPress Roles](#8-wordpress-roles)
9. [Post-Deploy Verification Checklist](#9-post-deploy-verification-checklist)
10. [Default Credentials](#10-default-credentials)
11. [Environment Variables](#11-environment-variables)

---

## 1. Option A — Docker (Local Dev / Staging)

Use Docker when developing locally or for staging. No PHP, MySQL, or WP-CLI installation required on the host.

### Prerequisites

- **Docker Desktop** installed and running (Windows, macOS, or Linux)
- Git repository cloned locally

### Step 1 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and adjust for your environment. The defaults work as-is for local dev:

```dotenv
# URL the portal will be reachable at (no trailing slash)
WP_URL=http://localhost:8080

# Host port exposed to your machine (use 80 for a remote server)
WP_PORT=8080

# WordPress admin credentials
WP_ADMIN_USER=admin
WP_ADMIN_PASSWORD=Admin1234!
WP_ADMIN_EMAIL=admin@test.com

# MySQL credentials
DB_PASSWORD=wp_test_pass
DB_ROOT_PASSWORD=rootpass
```

> For a server deployment, change `WP_URL` to your server address and set `WP_PORT=80`.

### Step 2 — Build and start containers

```bash
make up
```

Starts two containers: `db` (MySQL 8.0) and `wordpress` (WordPress 6.7, PHP 8.1, Apache 2.4).
Wait ~30 seconds for the database healthcheck to pass before running `make init`.

### Step 3 — Install WordPress (first time only)

```bash
make init
```

This runs `scripts/docker-init.sh` inside the container, which:

1. Waits for WordPress core files to be written
2. Installs WordPress with credentials from `.env`
3. Enables pretty permalinks (required for the REST API)
4. Activates the `research-review-portal` plugin
5. Creates the **Research Portal** page with the `[research_review_portal]` shortcode and sets it as the front page
6. Fixes `data/` directory permissions for `www-data`

Expected final output:
```
================================================================
  Setup complete!
  Portal: http://localhost:8080
  Admin:  http://localhost:8080/wp-admin
  Login:  admin / Admin1234!
================================================================
```

### Step 4 — Access the portal

| URL | Purpose |
|-----|---------|
| `http://localhost:8080/research-portal/?portal=1` | Portal front page |
| `http://localhost:8080/wp-admin` | WordPress admin |
| `http://localhost:8080/wp-json/research-portal/v1/health` | Health check (`{"ok":true}`) |

> The `?portal=1` query parameter is required to load the portal JS app. Without it the page renders blank.

### Step 5 — Create test users (optional)

Open a shell inside the container:

```bash
make shell
```

Then run:

```bash
wp user create student      student@test.com      --role=rrp_student      --user_pass=test123 --allow-root
wp user create reviewer     reviewer@test.com     --role=rrp_reviewer     --user_pass=test123 --allow-root
wp user create coordinator  coordinator@test.com  --role=rrp_coordinator  --user_pass=test123 --allow-root
wp user create rrpadmin     rrpadmin@test.com     --role=rrp_admin        --user_pass=test123 --allow-root
```

### Day-to-day commands

| Command | Description |
|---------|-------------|
| `make up` | Start containers in background |
| `make down` | Stop containers (data preserved in Docker volumes) |
| `make logs` | Tail Apache/PHP error log |
| `make shell` | Bash inside the WordPress container |
| `make build` | Rebuild the WordPress image (after `Dockerfile` changes) |
| `make rebuild` | Force-rebuild image from scratch (no cache) |
| `make db-export` | Export MySQL to `data/rrp-db-export.sql` |
| `make db-import` | Import `data/rrp-db-export.sql` into running container |
| `make db-shell` | Open a MySQL shell in the `db` container |
| `make reset` | ⚠ Destroy ALL volumes (database + WP files) and start fresh |

### Code changes during development

The entire repo directory is bind-mounted into the container at:
```
/var/www/html/wp-content/plugins/research-review-portal
```

Changes to any PHP or JS file are **immediately live** — no rebuild needed.

---

## 2. Option B — Bare-metal Ubuntu VM (Production)

### Prerequisites

- Ubuntu 22.04 LTS
- SSH access with `sudo` rights
- Repository cloned on the server

### Step 1 — SSH into the server

```bash
ssh azureadmin@<public url of the portal>
```

### Step 2 — Clone the repository

```bash
cd ~
git clone <repo-url> research-review-portal
cd research-review-portal
```

### Step 3 — Set the public URL

```bash
export WP_URL="http://<public url of the portal>"
```

Skip this step only if you want the server accessible only via `http://localhost`.

### Step 4 — Run the install script

```bash
chmod +x scripts/install-wsl.sh
./scripts/install-wsl.sh
```

The script runs these steps automatically:

| Step | Action |
|------|--------|
| 1 | Installs Apache 2.4, PHP 8.1 + extensions, MySQL, `curl`, `unzip` via `apt-get` |
| 2 | Downloads WP-CLI to `/usr/local/bin/wp` |
| 3 | Starts MySQL and Apache |
| 4 | Creates the `wordpress` database and `wp`@`localhost` MySQL user (password: `wp_test_pass`) |
| 5 | Downloads WordPress core to `/var/www/html` |
| 6 | Creates `wp-config.php` with DB credentials |
| 7 | Locks `WP_HOME` and `WP_SITEURL` to `$WP_URL` in `wp-config.php` |
| 8 | Runs `wp core install` (admin: `admin` / `Admin1234!`) |
| 9 | Enables pretty permalinks and writes `/var/www/html/.htaccess` |
| 10 | Enables `mod_rewrite`, sets `AllowOverride All` in Apache config, restarts Apache |
| 11 | Symlinks the repo into `/var/www/html/wp-content/plugins/research-review-portal` |
| 12 | Sets `data/` directory permissions to `777` |
| 13 | Activates the `research-review-portal` plugin |
| 14 | Creates the Research Portal page with `[research_review_portal]` shortcode and sets it as front page |
| 15 | Creates test users with password `test123` |
| 16 | Runs a health check against `/wp-json/research-portal/v1/health` |

Expected final output:
```
============================================================
  Install complete!
  Portal:    http://<your-url>/research-portal/?portal=1
  WP Admin:  http://<your-url>/wp-admin
             admin / Admin1234!

  Test logins (password: test123)
    student@test.com       — rrp_student
    reviewer@test.com      — rrp_reviewer
    coordinator@test.com   — rrp_coordinator
    rrpadmin@test.com      — rrp_admin
============================================================
```

### Step 5 — Set PHP upload limits

The install script does not configure PHP limits. Do this manually:

```bash
echo -e "upload_max_filesize=64M\npost_max_size=64M\nmemory_limit=256M\nmax_execution_time=60" \
  | sudo tee /etc/php/8.1/apache2/conf.d/99-rrp.ini
sudo service apache2 restart
```

### Step 6 — Verify

```bash
curl -sf http://localhost/wp-json/research-portal/v1/health
# Expected: {"ok":true}
```

**Troubleshooting:**

| Symptom | Fix |
|---------|-----|
| `curl: (7) Failed to connect` | Apache not running: `sudo service apache2 start` |
| 404 from health endpoint | `sudo wp rewrite flush --path=/var/www/html --allow-root && sudo service apache2 restart` |
| Portal page blank (no UI) | URL must end with `?portal=1` |
| MySQL connection error | MySQL not running: `sudo service mysql start` |

### Managing services

```bash
# Start / Stop / Restart
sudo service apache2 start
sudo service apache2 restart
sudo service mysql start
sudo service mysql restart

# Enable on boot
sudo systemctl enable apache2 mysql
```

### Tail logs

```bash
sudo tail -f /var/log/apache2/error.log
sudo tail -f /var/log/apache2/access.log
```

---

## 3. Deploying Code Changes to an Existing Server

After editing PHP or JS files locally, push them to the server via SFTP using `deploy.py` in the repo root.

### Requirements

```bash
pip install paramiko
```

### deploy.py — current configuration

The script uploads three files and reloads Apache:

```python
import paramiko, os

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('<public url of the portal>',
               username='azureadmin', password='Microsoft12345', timeout=30)

sftp = client.open_sftp()
base = '/var/www/html/wp-content/plugins/research-review-portal'
files = [
    ('includes/class-portal-rest.php', base + '/includes/class-portal-rest.php'),
    ('includes/class-portal-data.php', base + '/includes/class-portal-data.php'),
    ('assets/portal.js',               base + '/assets/portal.js'),
]
for local, remote in files:
    sftp.put(local, remote)
    status = 'OK' if os.path.getsize(local) == sftp.stat(remote).st_size else 'SIZE MISMATCH'
    print(f'{local}: [{status}]')
sftp.close()

_, out, _ = client.exec_command('echo Microsoft12345 | sudo -S apache2ctl graceful 2>&1; echo "EXIT:$?"')
print('Apache reload:', out.read().decode().strip())
client.close()
```

Run from the Windows dev machine:

```bash
cd D:\Development\CityU-Research-Tracker
python deploy.py
```

> **SSH port blocked?** If you get `TimeoutError: [WinError 10060]`, port 22 is blocked in the Azure NSG.
> Fix: Azure Portal → VM → **Networking** → **Inbound port rules** → confirm port 22 is set to **Allow**.
> Test: `Test-NetConnection -ComputerName <public url of the portal> -Port 22`

### Deploying from the server (rsync)

If the repo is cloned directly on the server:

```bash
sudo rsync -av --exclude='data/' \
  ~/research-review-portal/ \
  /var/www/html/wp-content/plugins/research-review-portal/

sudo apache2ctl graceful
```

### After deploying PHP changes

Always reload Apache after any `.php` change:

```bash
sudo apache2ctl graceful
```

If you changed `research-review-portal.php` or `class-portal-data.php`, also flush rewrite rules:

```bash
sudo wp rewrite flush --path=/var/www/html --allow-root
```

---

## 4. Changing the Public URL

Use this when moving from `http://localhost` to a real hostname, or switching servers.

```bash
chmod +x scripts/set-public-url.sh
./scripts/set-public-url.sh http://your-server.example.com
```

The script:
1. Updates `siteurl` and `home` in the WordPress database
2. Writes `WP_HOME` and `WP_SITEURL` constants to `wp-config.php` (overrides DB values — a DB restore cannot revert the URL back to localhost)
3. Flushes rewrite rules

After running, the portal is at:
```
http://your-server.example.com/research-portal/?portal=1
```

---

## 5. Enabling HTTPS with Lets Encrypt

Required for Microsoft Entra SSO.

### Prerequisites

- A domain name that resolves publicly to your server IP
- Ports 80 **and** 443 open in Azure NSG
- Portal working over HTTP first

### Open port 443 in Azure NSG

Azure Portal → Your VM → **Networking** → **Network Security Group** → **Add inbound rule**:

| Field | Value |
|-------|-------|
| Destination port | `443` |
| Protocol | TCP |
| Action | Allow |
| Priority | `340` |
| Name | `HTTPS` |

### Run the HTTPS script

```bash
export DOMAIN="your-portal.example.com"
export ADMIN_EMAIL="admin@your-institution.edu"

chmod +x scripts/enable-https.sh
sudo bash scripts/enable-https.sh
```

The script:
1. Installs `certbot` and the Apache plugin
2. Obtains a Let's Encrypt certificate for `$DOMAIN`
3. Configures automatic HTTP to HTTPS redirect
4. Updates WordPress `WP_HOME`/`WP_SITEURL` to `https://`
5. Runs `search-replace` to fix all `http://` links in the database
6. Flushes rewrite rules
7. Verifies the auto-renewal cron at `/etc/cron.d/certbot`

### Verify HTTPS

```bash
curl -I http://your-portal.example.com   # Expected: 301 redirect to https
curl -I https://your-portal.example.com  # Expected: 200
sudo certbot renew --dry-run             # Test auto-renewal (no changes made)
```

After enabling HTTPS, update the Entra App Registration redirect URI from `http://` to `https://`.

---

## 6. Microsoft Entra ID SSO Setup

### Step 1 — Create an App Registration

1. [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name: `CityU Research Review Portal`
3. Redirect URI type: **Web**
4. Redirect URI: `https://your-portal.example.com/wp-json/research-portal/v1/auth/callback`
5. Click **Register**

### Step 2 — Collect credentials

From the **Overview** page:
- **Application (client) ID** — your Client ID
- **Directory (tenant) ID** — your Tenant ID

From **Certificates & secrets** → **New client secret**:
- Copy the **Value** immediately (shown only once)

From **Authentication**:
- Under **Implicit grant**, enable **ID tokens** → **Save**

### Step 3 — Configure the portal

Log in as admin → **Administration → Portal Settings → SSO**:

| Field | Value |
|-------|-------|
| Tenant ID | Directory (tenant) ID |
| Client ID | Application (client) ID |
| Client Secret | Client secret value |
| Redirect URI | `https://your-portal.example.com/wp-json/research-portal/v1/auth/callback` |
| Enable SSO | On |

Click **Save**. The "Sign in with Microsoft" button appears on the login page.

> New SSO users are automatically created as `rrp_student`. Change the role via **WordPress Admin → Users**.

---

## 7. Database Reference

### Schema creation

No manual SQL needed. On first plugin load, `Portal_Data::maybe_migrate()` runs automatically:
- Checks `rrp_db_version` in `wp_options`
- If not `1.0`: creates `wp_rrp_submissions` via `dbDelta()`, migrates legacy JSON data
- Sets `rrp_db_version = 1.0` (idempotent — fast no-op on subsequent loads)

### Submissions table schema

```sql
CREATE TABLE wp_rrp_submissions (
  submission_id   VARCHAR(50)  NOT NULL,   -- e.g. dissertation-2026-001
  status          VARCHAR(100) NOT NULL DEFAULT '',
  submitter_email VARCHAR(191) NOT NULL DEFAULT '',
  submission_type VARCHAR(100) NOT NULL DEFAULT '',
  created_at      DATETIME     NOT NULL DEFAULT '0000-00-00 00:00:00',
  data            LONGTEXT     NOT NULL,   -- full submission as JSON
  PRIMARY KEY (submission_id),
  KEY idx_status          (status),
  KEY idx_submitter_email (submitter_email),
  KEY idx_submission_type (submission_type),
  KEY idx_created_at      (created_at)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Submission ID format

Generated as `{type}-{year}-{sequence}` with a separate counter per type:

| Example | Type slug |
|---------|-----------|
| `dissertation-2026-001` | `dissertation` |
| `dissertation-final-2026-001` | `dissertation-final` |
| `conference-2026-003` | `conference` |

Counters stored in the `rrp_next_ids` WordPress option.

### Inspect the database

```bash
WP="sudo wp --path=/var/www/html --allow-root"

# List recent submissions
$WP db query "SELECT submission_id, status, submitter_email, created_at FROM wp_rrp_submissions ORDER BY created_at DESC LIMIT 20;"

# Check DB schema version (should be 1.0)
$WP option get rrp_db_version

# Check ID counters
$WP option get rrp_next_ids
```

### Backup and restore

**Docker:**
```bash
make db-export    # saves to data/rrp-db-export.sql
make db-import    # restores from data/rrp-db-export.sql
```

**Bare-metal:**
```bash
# Backup
mysqldump -u wp -pwp_test_pass wordpress > /tmp/rrp-backup-$(date +%Y%m%d).sql

# Restore
mysql -u wp -pwp_test_pass wordpress < /tmp/rrp-backup-YYYYMMDD.sql
```

### WordPress options used

| Key | Content |
|-----|---------|
| `rrp_db_version` | Schema version (`1.0`) |
| `rrp_next_ids` | Per-type submission ID counters |
| `rrp_portal_settings` | AES-256-GCM encrypted portal settings |
| `rrp_webhooks` | Registered webhook endpoints |

> **Encryption warning:** `entra_client_secret`, `smtp_password`, `azure_blob_sas_url`, `acs_connection_string`, `turnitin_api_key`, and `ithenticate_api_key` are encrypted using a key derived from `wp-config.php` salts. Restoring the database to a WordPress install with different salts requires re-entering these values.

---

## 8. WordPress Roles

Roles are created automatically when the plugin activates. No manual setup needed.

| Role slug | Display name | Primary permissions |
|-----------|-------------|---------------------|
| `rrp_student` | Research Student | Submit, view, edit own submissions |
| `rrp_reviewer` | Research Reviewer | Review assigned submissions, provide feedback |
| `rrp_coordinator` | Research Coordinator | Assign reviewers, manage workflow, view all submissions |
| `rrp_admin` | Research Administrator | Full admin, manage users and config, export data |
| `rrp_faculty` | Research Faculty | Review assigned submissions, view all submissions |
| `rrp_public` | Public Submitter | Submit, view, edit own submissions |

**To recreate missing roles** (e.g. after roles table corruption):

```bash
WP="--path=/var/www/html --allow-root"
wp $WP plugin deactivate research-review-portal
wp $WP plugin activate  research-review-portal
```

**To set a reviewer's short ID:**

```bash
# Replace <user_id> with the numeric WordPress user ID
wp --path=/var/www/html --allow-root user meta update <user_id> rrp_reviewer_id r1
```

Or via **WordPress Admin → Users → Edit User → Reviewer ID**.

---

## 9. Post-Deploy Verification Checklist

Run after every deployment.

### 1. Health endpoint

```bash
curl -sf http://<public url of the portal>/wp-json/research-portal/v1/health
# PASS: {"ok":true}
```

### 2. Portal page loads

Open in browser — should show the portal login screen (not a blank page):
```
http://<public url of the portal>/research-portal/?portal=1
```

### 3. DB schema initialized

```bash
sudo wp --path=/var/www/html --allow-root option get rrp_db_version
# Expected: 1.0

sudo wp --path=/var/www/html --allow-root db query "SHOW TABLES LIKE 'wp_rrp_submissions';"
# Expected: wp_rrp_submissions
```

### 4. Roles present

```bash
wp --path=/var/www/html --allow-root role list | grep rrp
# Expected: rrp_student, rrp_reviewer, rrp_coordinator, rrp_admin, rrp_faculty, rrp_public
```

### 5. PHP upload limits

```bash
php -r "echo ini_get('upload_max_filesize');"
# Expected: 64M
```

### 6. Login with each test role

| Role | Email | Password |
|------|-------|----------|
| Student | `student@test.com` | `test123` |
| Reviewer | `reviewer@test.com` | `test123` |
| Coordinator | `coordinator@test.com` | `test123` |
| Admin | `rrpadmin@test.com` | `test123` |

Each role should land on the correct dashboard after login.

---

## 10. Default Credentials

| Where | Username / Email | Password |
|-------|-----------------|----------|
| WordPress admin | `admin` | `Admin1234!` |
| Test student | `student@test.com` | `test123` |
| Test reviewer | `reviewer@test.com` | `test123` |
| Test coordinator | `coordinator@test.com` | `test123` |
| Test portal admin | `rrpadmin@test.com` | `test123` |
| Production VM SSH | `azureadmin` | *(set at VM provisioning)* |

> **Change all default passwords before exposing the portal to end users.**

---

## 11. Environment Variables

Read from `.env` (copy from `.env.example`). Used by `docker-compose.yml` and `scripts/docker-init.sh` only — not read by the PHP plugin at runtime.

| Variable | Default | Description |
|----------|---------|-------------|
| `WP_URL` | `http://localhost:8080` | Public portal URL (no trailing slash) |
| `WP_PORT` | `8080` | Host port mapped to container port 80. Use `80` on a server |
| `WP_ADMIN_USER` | `admin` | WordPress admin username |
| `WP_ADMIN_PASSWORD` | `Admin1234!` | WordPress admin password |
| `WP_ADMIN_EMAIL` | `admin@test.com` | WordPress admin email |
| `DB_PASSWORD` | `wp_test_pass` | MySQL `wp` user password |
| `DB_ROOT_PASSWORD` | `rootpass` | MySQL root password (Docker only) |
