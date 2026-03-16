# Deployment Guide — Research Review Portal

> **Recommended path: Option A (Docker).** Works on any machine with Docker Desktop — no PHP, Apache, or MySQL install required. Options B covers bare-metal / WSL Ubuntu for servers without Docker.

---

## Production stack (what runs in production today)

| Component  | Version            |
|------------|--------------------|
| OS         | Ubuntu 22.04 LTS   |
| Web server | Apache 2.4.52      |
| PHP        | 8.1.2              |
| MySQL      | 8.0.45             |
| WordPress  | 6.7                |
| PHP ext.   | curl, gd, mbstring, mysqli, xml, zip, opcache |

---

## Option A — Docker (recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running  
- The repository cloned to your local machine

### Steps

**1. Create a `.env` file from the template:**
```powershell
# Windows PowerShell
Copy-Item .env.example .env
```
```bash
# macOS / Linux / WSL
cp .env.example .env
```

Edit `.env` to set `WP_URL`:
- **Local dev:** `WP_URL=http://localhost:8080` (default — no change needed)  
- **Remote server on port 80:** `WP_URL=http://your-server.example.com` and `WP_PORT=80`

**2. Build and start containers:**
```bash
make up
# or without Make:
docker compose up -d
```

**3. Install WordPress + activate plugin (first time only):**
```bash
make init
# or without Make:
docker compose exec wordpress bash /usr/local/bin/docker-init.sh
```

This command:
- Installs WordPress core with the admin account from `.env`
- Enables pretty permalinks (required for REST API)
- Activates the Research Review Portal plugin
- Creates the portal page and sets it as the front page
- Fixes data directory write permissions

**4. Open the portal:**
```
http://localhost:8080          ← portal front page
http://localhost:8080/wp-admin ← WordPress admin (admin / Admin1234!)
```

### Day-to-day commands

| Command | Description |
|---------|-------------|
| `make up` | Start containers |
| `make down` | Stop containers (data preserved) |
| `make logs` | Tail Apache/PHP logs |
| `make shell` | Open bash in the WordPress container |
| `make build` | Rebuild the image after Dockerfile changes |
| `make db-export` | Export DB → `data/rrp-db-export.sql` |
| `make db-import` | Import `data/rrp-db-export.sql` |
| `make reset` | ⚠ Destroy volumes and start fresh |

### Redeploy to a different server

1. Clone the repo on the new server  
2. Copy `.env.example` to `.env` and set `WP_URL=http://new-server` and `WP_PORT=80`  
3. Run `make up && make init`  
4. Optionally restore data: `make db-import` (after copying `data/rrp-db-export.sql`)

> **Note:** The `data/` folder (submissions, reviewers, config, uploads) is bind-mounted from the repo — it is automatically present without any import step.

---

## Option B — Bare-metal Ubuntu / WSL

Use this when Docker is not available (e.g., a plain Ubuntu VM).

### Prerequisites
- Ubuntu 22.04 LTS (bare-metal, VM, or WSL2)
- The repository cloned or accessible at any local path

### Steps

```bash
# Set the public URL if not localhost
export WP_URL="http://deployvm.cityu.edu"

# Run from anywhere inside the cloned repo
chmod +x scripts/install-wsl.sh
./scripts/install-wsl.sh
```

The script auto-detects the repo path from its own location — no manual path editing is needed.

After installation, start services on every boot:

```bash
sudo service mysql  start
sudo service apache2 start
```

### Change the public URL on an existing WSL install

```bash
# Quick swap — updates DB option and wp-config constants
export NEW_URL="http://new-hostname.example.com"
./scripts/set-public-url.sh "$NEW_URL"
```

---

## Data persistence

| What | Location | Notes |
|------|----------|-------|
| Submissions, config, reviewers | `data/*.json` | In the repo — bind-mounted in Docker |
| Uploaded documents | `data/uploads/` | In the repo — bind-mounted in Docker |
| WordPress user accounts | MySQL `wordpress` DB | Stored in Docker named volume `db_data` |
| WordPress core files | `/var/www/html` | Stored in Docker named volume `wp_data` |

To back up everything in Docker:

```bash
make db-export          # writes data/rrp-db-export.sql
git add data/           # commits JSON data + db dump
```

---

## Default credentials

| Role | Username | Password |
|------|----------|----------|
| WP Admin | `admin` | `Admin1234!` |
| Test student | `student@test.com` | `test123` |
| Test reviewer | `reviewer@test.com` | `test123` |
| Test coordinator | `coordinator@test.com` | `test123` |
| Test portal admin | `rrpadmin@test.com` | `test123` |

> Change all passwords before exposing to the internet.

---

## Post-install: Create test users

The `make init` / `docker-init.sh` script creates the WordPress admin only. Create role-specific test users with WP-CLI (run inside the container with `make shell`):

```bash
wp user create student      student@test.com      --role=rrp_student      --user_pass=test123 --allow-root
wp user create reviewer     reviewer@test.com     --role=rrp_reviewer     --user_pass=test123 --allow-root
wp user create coordinator  coordinator@test.com  --role=rrp_coordinator  --user_pass=test123 --allow-root
wp user create rrpadmin     rrpadmin@test.com     --role=rrp_admin        --user_pass=test123 --allow-root
```

---

## Quick smoke test

| Step | URL / action | Expected result |
|------|-------------|-----------------|
| 1 | `/wp-json/research-portal/v1/health` | `{"ok":true,"bootId":"<number>"}` |
| 2 | Log in as `student@test.com`, open portal | Submission form visible |
| 3 | Submit a conference abstract | Confirmation with reference ID |
| 4 | Log in as `reviewer@test.com`, open Reviewer Dashboard | Assigned submission listed |
| 5 | Log in as `rrpadmin@test.com`, open Dashboard | All submissions listed |
| 6 | Click **📋 Log** on any submission | Slide-in audit log with timestamped events |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| REST API returns 401 | Set WordPress permalinks to **Post name** (Settings → Permalinks → Save) |
| JSON write errors / submissions not saving | `chmod -R 777 data/` inside the plugin folder, or re-run `make init` |
| "Portal API not configured" on page | Plugin not activated — run `make init` or activate via WP Admin → Plugins |
| Roles not in Add User dropdown | Deactivate and re-activate the plugin (role registration runs on activation hook) |
| File uploads silently fail | Verify `data/uploads/` exists and is writable; check `upload_max_filesize` in php.ini |
| Chrome redirects to localhost | Ensure `WP_URL` in `.env` matches the hostname you are browsing from, then `make down && make up` |
| Container won't start (port conflict) | Change `WP_PORT` in `.env` to an unused port and `make down && make up` |

---

## Exposing a Docker container to the internet

Set `WP_URL` and `WP_PORT` in `.env`, then rebuild:

```bash
# Example: public VM at deployvm.cityu.edu, port 80
echo "WP_URL=http://deployvm.cityu.edu" >> .env
echo "WP_PORT=80" >> .env
make down
make up
make init   # only if first time on this server
```

**Azure NSG checklist** (portal → VM → Networking → Inbound port rules):

| Check | Detail |
|-------|--------|
| TCP port 80 open | Inbound rule from Any → Any, port 80 |
| Public IP is Static | VM → Overview → Public IP → Configuration |
| Optional: port 443 | For HTTPS via Certbot |

### Adding HTTPS (optional)

```bash
make shell
apt-get install -y certbot python3-certbot-apache
certbot --apache -d <YOUR-VM-HOSTNAME>
```

Then update `.env` with `WP_URL=https://...`, `make down && make up`.
