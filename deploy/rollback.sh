#!/usr/bin/env bash
# =============================================================================
# rollback.sh — Roll back the Docker deployment to a previous snapshot
# =============================================================================
# Usage:
#   sudo bash rollback.sh [OPTIONS]
#
# Options:
#   --list          List available backups and exit
#   --to  BACKUP    Roll back to the specified backup file (non-interactive)
#   --db-only       Restore database only; leave application files as-is
#   --app-only      Restore application files only; skip database restore
#   --steps N       Number of migration batches to roll back (default: 1)
#
# This script must be run on the production VM (not your local machine).
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

[[ $EUID -ne 0 ]] && error "Run this script as root (sudo bash rollback.sh)"

# ---------- defaults ----------------------------------------------------------
BACKUP_DIR="/opt/rrp-backups"
REMOTE_DIR="/opt/rrp-v2"
LIST_ONLY=false
TARGET_BACKUP=""
DB_ONLY=false
APP_ONLY=false
MIGRATE_STEPS=1

# ---------- parse arguments ---------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --list)     LIST_ONLY=true;         shift   ;;
    --to)       TARGET_BACKUP="$2";     shift 2 ;;
    --db-only)  DB_ONLY=true;           shift   ;;
    --app-only) APP_ONLY=true;          shift   ;;
    --steps)    MIGRATE_STEPS="$2";     shift 2 ;;
    *) error "Unknown argument: $1" ;;
  esac
done

# ---------- list backups ------------------------------------------------------
list_backups() {
  if [[ ! -d "$BACKUP_DIR" ]] || [[ -z "$(ls -A "$BACKUP_DIR"/*.tar.gz 2>/dev/null)" ]]; then
    warn "No backups found in $BACKUP_DIR"
    exit 0
  fi
  echo ""
  echo "Available backups in $BACKUP_DIR:"
  echo "-----------------------------------"
  ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null | awk '{print NR")", $NF, "(" $5 ")"}'
  echo ""
}

list_backups
[[ "$LIST_ONLY" == true ]] && exit 0

# ---------- select backup interactively if not specified ----------------------
if [[ -z "$TARGET_BACKUP" ]]; then
  BACKUPS=("$BACKUP_DIR"/*.tar.gz)
  if [[ ${#BACKUPS[@]} -eq 0 ]]; then
    error "No backups found in $BACKUP_DIR. Nothing to roll back to."
  fi

  echo "Enter the number of the backup to restore (or 'q' to quit):"
  read -r SELECTION
  [[ "$SELECTION" == "q" ]] && exit 0
  INDEX=$(( SELECTION - 1 ))
  TARGET_BACKUP="${BACKUPS[$INDEX]}"
fi

[[ ! -f "$TARGET_BACKUP" ]] && error "Backup file not found: $TARGET_BACKUP"

info "Rolling back to: $TARGET_BACKUP"
echo ""
echo -e "${YELLOW}WARNING: This will overwrite the current application state.${NC}"
echo "Type 'yes' to confirm, or anything else to abort:"
read -r CONFIRM
[[ "$CONFIRM" != "yes" ]] && { warn "Rollback aborted."; exit 0; }

# ---------- 1. Create a safety snapshot of current state ---------------------
info "Creating safety snapshot of current state..."
SAFETY="$BACKUP_DIR/pre-rollback-$(date +%Y%m%d_%H%M%S).tar.gz"
docker exec rrp_postgres pg_dump -U rrp_app rrp_production 2>/dev/null | \
  gzip > /tmp/rrp_pre_rollback.sql.gz || warn "Could not dump current DB (container may be down)"
tar -czf "$SAFETY" -C "$REMOTE_DIR" backend/app backend/config 2>/dev/null \
  && info "Safety snapshot saved to $SAFETY" \
  || warn "Could not create safety snapshot."

# ---------- 2. Extract backup ------------------------------------------------
info "Extracting backup archive..."
EXTRACT_DIR="$(mktemp -d /tmp/rrp_rollback_XXXXXX)"
tar -xzf "$TARGET_BACKUP" -C "$EXTRACT_DIR"

# ---------- 3. Restore application files -------------------------------------
if [[ "$DB_ONLY" == false ]]; then
  info "Restoring application files..."
  if [[ -d "$EXTRACT_DIR/backend" ]]; then
    rsync -a --exclude='.env' --exclude='vendor' --exclude='storage/logs' \
      "$EXTRACT_DIR/backend/" "$REMOTE_DIR/backend/"
    info "Application files restored."
  else
    warn "No backend/ directory found in backup archive — skipping app file restore."
  fi
fi

# ---------- 4. Restore database ----------------------------------------------
if [[ "$APP_ONLY" == false ]]; then
  DB_DUMP=$(find "$EXTRACT_DIR" -name "*.sql.gz" -o -name "*.sql" | head -1)
  if [[ -n "$DB_DUMP" ]]; then
    info "Restoring database from $DB_DUMP ..."
    docker compose -f "$REMOTE_DIR/docker-compose.yml" stop worker 2>/dev/null || true

    if [[ "$DB_DUMP" == *.gz ]]; then
      gunzip -c "$DB_DUMP" | docker exec -i rrp_postgres \
        psql -U rrp_app -d rrp_production
    else
      docker exec -i rrp_postgres \
        psql -U rrp_app -d rrp_production < "$DB_DUMP"
    fi
    info "Database restored."
  else
    warn "No SQL dump found in backup archive — rolling back migrations instead."
    docker exec rrp_app php artisan migrate:rollback --step="$MIGRATE_STEPS" --force
    info "Migration rollback complete (last $MIGRATE_STEPS batch(es))."
  fi
fi

# ---------- 5. Restart Composer install + caches -----------------------------
if [[ "$DB_ONLY" == false ]]; then
  info "Reinstalling Composer dependencies (no-dev)..."
  docker exec rrp_app composer install --no-dev --optimize-autoloader --no-interaction \
    --working-dir=/var/www/html 2>/dev/null || true

  info "Rebuilding caches..."
  docker exec rrp_app php artisan config:cache
  docker exec rrp_app php artisan route:cache
  docker exec rrp_app php artisan view:cache
fi

# ---------- 6. Restart services ----------------------------------------------
info "Restarting services..."
docker compose -f "$REMOTE_DIR/docker-compose.yml" restart app worker 2>/dev/null || true

# ---------- Cleanup -----------------------------------------------------------
rm -rf "$EXTRACT_DIR"

info "============================================================"
info " Rollback complete!"
info " Restored from : $TARGET_BACKUP"
info " Safety backup : $SAFETY"
info ""
info " Run 'docker compose logs -f app' to confirm normal operation."
info "============================================================"
