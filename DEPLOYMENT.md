# Deployment Guide — CityU Research Review Portal

> **Current production:** Azure VM — HTTPS, WordPress 6.7, PHP 8.1

---

## Table of Contents

1. [Option A — Docker (Recommended)](#1-option-a--docker-recommended)
2. [Option B — Bare-metal / Azure VM](#2-option-b--bare-metal--azure-vm)
3. [Updating an Existing Install](#3-updating-an-existing-install)
4. [Enabling HTTPS (Let's Encrypt)](#4-enabling-https-lets-encrypt)
5. [Microsoft Entra ID SSO Setup](#5-microsoft-entra-id-sso-setup)
6. [Default Credentials](#6-default-credentials)
7. [Environment Variables Reference](#7-environment-variables-reference)

---

## 1. Option A — Docker (Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Repository cloned to your local machine

### 1.1 First-time setup

```bash
# 1. Create your .env file
cp .env.example .env
# Edit .env — set WP_URL to your server's URL (leave as http://localhost:8080 for local dev)

# 2. Build and start containers
make up

# 3. Install WordPress + activate plugin (first time only)
make init
```

### 1.2 Access the portal

| URL | Purpose |
|-----|---------|
| `http://localhost:8080` | Portal front page |
| `http://localhost:8080/wp-admin` | WordPress admin |

Default credentials after `make init`: `admin` / `Admin1234!`

### 1.3 Create test users

Run `make shell` to open a bash session inside the WordPress container, then:

```bash
wp user create student student@test.com --role=rrp_student --user_pass=test123 --allow-root
wp user create reviewer reviewer@test.com --role=rrp_reviewer --user_pass=test123 --allow-root
wp user create coordinator coord@test.com --role=rrp_coordinator --user_pass=test123 --allow-root
wp user create rrpadmin admin@test.com --role=rrp_admin --user_pass=test123 --allow-root
```

### 1.4 Day-to-day commands

| Command | Description |
|---------|-------------|
| `make up` | Start containers |
| `make down` | Stop containers (data preserved) |
| `make logs` | Tail Apache / PHP error log |
| `make shell` | Bash inside WordPress container |
| `make build` | Rebuild image after Dockerfile changes |
| `make db-export` | Export MySQL → `data/rrp-db-export.sql` |
| `make db-import` | Import `data/rrp-db-export.sql` |
| `make reset` | ⚠ Destroy all volumes and start fresh |

### 1.5 Deploying to a remote server via Docker

1. Clone the repo on the remote server.
2. Create `.env` with `WP_URL=http://your-server.example.com` and `WP_PORT=80`.
3. Run `make up && make init`.
4. (Optional) restore previous data: `make db-import` after copying `data/rrp-db-export.sql`.

> The `data/` folder (submissions, reviewers, config, uploads) is bind-mounted from the repo — no additional import step is needed for JSON data.

---

## 2. Option B — Bare-metal / Azure VM

Use this when Docker is not available.

### 2.1 Prerequisites
- Ubuntu 22.04 LTS
- Sudo access
- Repository cloned at any local path

### 2.2 Installation

```bash
# Optional: set the public URL (defaults to http://localhost)
export WP_URL="https://portal.your-institution.edu"

# Run the install script
chmod +x scripts/install-wsl.sh
./scripts/install-wsl.sh
```

The script installs Apache, PHP 8.1, MySQL, WordPress, activates the plugin, sets up pretty permalinks, and fixes data directory permissions.

### 2.3 Start services on boot

```bash
sudo service apache2 start
sudo service mysql start
```

Or enable systemd:
```bash
sudo systemctl enable apache2 mysql
```

### 2.4 Change the public URL on an existing install

```bash
export NEW_URL="https://new-hostname.example.com"
./scripts/set-public-url.sh "$NEW_URL"
```

This updates both the WordPress database `siteurl`/`home` options and the `wp-config.php` constants.

### 2.5 Deploy updated plugin files

After making code changes, copy modified files to the plugin directory:

```bash
PLUGIN=/var/www/html/wp-content/plugins/research-review-portal

# Copy one file
sudo cp assets/portal.js $PLUGIN/assets/portal.js

# Or sync the whole plugin (excludes data/ to protect live data)
sudo rsync -av --exclude='data/' ./ $PLUGIN/
```

To deploy from a Windows development machine via paramiko (Python SFTP):

```python
import paramiko, os

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('portal.your-institution.edu',
               username='<vm-user>', password='<password>', timeout=30)
sftp = client.open_sftp()
sftp.put('assets/portal.js',
         '/var/www/html/wp-content/plugins/research-review-portal/assets/portal.js')
sftp.close()
client.close()
```

### 2.6 File permissions

The web server user must have read/write access to the `data/` directory:

```bash
sudo chown -R www-data:www-data \
  /var/www/html/wp-content/plugins/research-review-portal/data
sudo chmod -R 775 \
  /var/www/html/wp-content/plugins/research-review-portal/data
```

### 2.7 PHP configuration

The plugin requires these PHP settings (set in a custom `.ini` drop-in or `php.ini`):

```ini
upload_max_filesize = 64M
post_max_size       = 64M
memory_limit        = 256M
max_execution_time  = 60
```

On Ubuntu with PHP 8.1:
```bash
echo -e "upload_max_filesize=64M\npost_max_size=64M\nmemory_limit=256M\nmax_execution_time=60" \
  | sudo tee /etc/php/8.1/apache2/conf.d/99-rrp.ini
sudo service apache2 restart
```

### 2.8 Verify installation

```bash
curl -sf https://localhost/wp-json/research-portal/v1/health
# Expected: {"ok":true,"bootId":<number>}
```

---

## 3. Updating an Existing Install

### 3.1 Docker

```bash
# Pull latest code
git pull

# Rebuild and restart
make build
make down
make up
```

If the database schema changed (rare), run `make init` again — it is idempotent.

### 3.2 Bare-metal (production Azure VM)

Deploy changed files directly to the plugin directory:

```bash
ssh <vm-user>@portal.your-institution.edu
cd /var/www/html/wp-content/plugins/research-review-portal

# Pull if deployed from git
git pull

# Or copy specific files from dev machine (using paramiko/SFTP as shown in 2.5)
```

After updating `class-portal-rest.php` or `research-review-portal.php`, flush rewrite rules:
```bash
wp --path=/var/www/html --allow-root rewrite flush
```

---

## 4. Enabling HTTPS (Let's Encrypt)

Microsoft Entra SSO requires HTTPS. The production VM already has HTTPS active. Use this section when setting up a new server.

### 4.1 Open port 443 in Azure NSG

In the Azure Portal → VM → **Networking** → **Network Security Group** → **Add inbound rule**:
- Destination port: `443`, Protocol: TCP, Action: Allow, Priority: `340`, Name: `HTTPS`

### 4.2 Run the HTTPS setup script

```bash
ssh <vm-user>@portal.your-institution.edu
cd /var/www/html/wp-content/plugins/research-review-portal
sudo bash scripts/enable-https.sh
```

The script:
- Installs Certbot + Apache plugin
- Obtains a Let's Encrypt certificate for your domain
- Configures HTTP → HTTPS redirect
- Updates WordPress `siteurl` / `home` to `https://`
- Installs auto-renewal cron (certificates renew every 60 days; valid for 90)

The script is idempotent — safe to re-run.

### 4.3 Verify HTTPS

```bash
curl -I http://your-domain.example.com   # should return 301 redirect
curl -I https://your-domain.example.com  # should return 200
```

### 4.4 Test certificate renewal

```bash
sudo certbot renew --dry-run
```

---

## 5. Microsoft Entra ID SSO Setup

### 5.1 Create the App Registration

1. In the [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name: `CityU Research Review Portal`
3. Redirect URI (Web): `https://your-domain/wp-json/research-portal/v1/auth/callback`
4. Click **Register**.

### 5.2 Configure the App Registration

1. **Certificates & secrets** → **New client secret** → copy the value immediately.
2. **Overview** — note the **Application (client) ID** and **Directory (tenant) ID**.
3. **Authentication** — enable **ID tokens** under Implicit grant.

### 5.3 Configure the Portal

In the portal, log in as an Admin and go to **Administration → Portal Settings → SSO**.

| Field | Value |
|-------|-------|
| Tenant ID | Directory (tenant) ID from App Registration |
| Client ID | Application (client) ID from App Registration |
| Client Secret | Secret value you copied |
| Redirect URI | `https://your-domain/wp-json/research-portal/v1/auth/callback` |
| Enable SSO | Toggle On |

Click **Save**. The "Sign in with Microsoft" button will appear on the login page.

### 5.4 User provisioning

On first SSO login, the portal automatically creates a WordPress user account for the user. New SSO users are assigned the `rrp_student` role by default. An admin can then change the role from the Users panel.

---

## 6. Default Credentials

| Where | Username | Password |
|-------|----------|----------|
| WordPress Admin (Docker) | `admin` | `Admin1234!` |
| Test student | `student@test.com` | `test123` |
| Test reviewer | `reviewer@test.com` | `test123` |
| Test coordinator | `coordinator@test.com` | `test123` |
| Test portal admin | `rrpadmin@test.com` | `test123` |
| Production VM (SSH) | `<vm-user>` | *(set at VM provisioning)* |

> **Change all default passwords before exposing the site to the internet.**

---

## 7. Environment Variables Reference

All variables come from `.env` (copy from `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `WP_URL` | `http://localhost:8080` | Public URL of the portal |
| `WP_PORT` | `8080` | Host port mapped to container port 80 |
| `WP_ADMIN_USER` | `admin` | WordPress admin username |
| `WP_ADMIN_PASS` | `Admin1234!` | WordPress admin password |
| `WP_ADMIN_EMAIL` | `admin@example.com` | WordPress admin email |
| `MYSQL_ROOT_PASSWORD` | `rootpass` | MySQL root password (Docker only) |
| `MYSQL_DATABASE` | `wordpress` | MySQL database name |
| `MYSQL_USER` | `wp` | MySQL application user |
| `MYSQL_PASSWORD` | `wp_test_pass` | MySQL application password |

These variables are used by `docker-compose.yml` and `scripts/docker-init.sh`. They are not read at runtime by the PHP plugin (which uses WordPress's own database connection).
