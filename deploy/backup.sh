#!/usr/bin/env bash
# =============================================================================
# backup.sh — Standalone backup for the RRP v2 production Docker deployment
# =============================================================================
# Usage:
#   sudo bash backup.sh [OPTIONS]
#
# Options:
#   --keep-days  N     Number of daily backups to retain (default: 14)
#   --output-dir DIR   Override default backup directory (/opt/rrp-backups)
#   --db-only          Database dump only, skip application files
#   --upload           Upload to Azure Blob Storage after backup
#                      (requires AZURE_STORAGE_ACCOUNT + AZURE_STORAGE_KEY env vars)
#
# Recommended cron (daily at 2am):
#   0 2 * * * root bash /opt/rrp-v2/deploy/backup.sh --keep-days 14 >> /var/log/rrp-backup.log 2>&1
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[$(date '+%H:%M:%S') INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[$(date '+%H:%M:%S') WARN]${NC}  $*"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S') ERROR]${NC} $*" >&2; exit 1; }

# ---------- defaults ----------------------------------------------------------
KEEP_DAYS=14
OUTPUT_DIR="/opt/rrp-backups"
REMOTE_DIR="/opt/rrp-v2"
DB_ONLY=false
UPLOAD=false
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="rrp-backup-$TIMESTAMP"
AZURE_STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT:-}"
AZURE_STORAGE_KEY="${AZURE_STORAGE_KEY:-}"
AZURE_STORAGE_CONTAINER="${AZURE_STORAGE_CONTAINER:-rrp-backups}"

# ---------- parse arguments ---------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-days)   KEEP_DAYS="$2";   shift 2 ;;
    --output-dir)  OUTPUT_DIR="$2";  shift 2 ;;
    --db-only)     DB_ONLY=true;     shift   ;;
    --upload)      UPLOAD=true;      shift   ;;
    *) error "Unknown argument: $1" ;;
  esac
done

[[ $EUID -ne 0 ]] && error "Run this script as root (sudo bash backup.sh)"

mkdir -p "$OUTPUT_DIR"
WORK_DIR="$(mktemp -d /tmp/rrp_backup_XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

info "Starting backup: $BACKUP_NAME"

# ---------- 1. Database dump --------------------------------------------------
info "Dumping PostgreSQL database..."
if docker ps --filter "name=rrp_postgres" --filter "status=running" --format "{{.Names}}" | grep -q rrp_postgres; then
  docker exec rrp_postgres pg_dump \
    -U rrp_app \
    --no-password \
    --format=custom \
    --compress=6 \
    rrp_production > "$WORK_DIR/database.pgdump"
  info "Database dump: $(du -sh "$WORK_DIR/database.pgdump" | cut -f1)"
else
  error "Container rrp_postgres is not running. Aborting backup."
fi

# ---------- 2. Application files (uploads, storage) --------------------------
if [[ "$DB_ONLY" == false ]]; then
  info "Archiving application storage (uploads, logs)..."
  docker exec rrp_app tar -czf /tmp/storage.tar.gz \
    -C /var/www/html/storage \
    --exclude='framework/cache' \
    --exclude='framework/sessions' \
    --exclude='framework/views' \
    app 2>/dev/null || warn "Could not archive storage from container."

  docker cp rrp_app:/tmp/storage.tar.gz "$WORK_DIR/storage.tar.gz" 2>/dev/null \
    && info "Storage archive: $(du -sh "$WORK_DIR/storage.tar.gz" | cut -f1)" \
    || warn "Could not copy storage archive from container."

  # Also back up the .env (without exposing it in the main archive)
  if [[ -f "$REMOTE_DIR/backend/.env" ]]; then
    install -m 600 "$REMOTE_DIR/backend/.env" "$WORK_DIR/env.backup"
    info ".env backed up."
  fi
fi

# ---------- 3. Bundle into a single tarball -----------------------------------
ARCHIVE="$OUTPUT_DIR/$BACKUP_NAME.tar.gz"
info "Creating final archive: $ARCHIVE ..."
tar -czf "$ARCHIVE" -C "$WORK_DIR" .
ARCHIVE_SIZE=$(du -sh "$ARCHIVE" | cut -f1)
info "Archive created: $ARCHIVE ($ARCHIVE_SIZE)"

# ---------- 4. Rotate old backups --------------------------------------------
info "Rotating backups older than $KEEP_DAYS days..."
find "$OUTPUT_DIR" -name "rrp-backup-*.tar.gz" -mtime "+$KEEP_DAYS" -print -delete \
  && info "Old backups removed." \
  || warn "Could not remove old backups."

CURRENT_COUNT=$(find "$OUTPUT_DIR" -name "rrp-backup-*.tar.gz" | wc -l)
info "Backup count now: $CURRENT_COUNT"

# ---------- 5. Optional Azure Blob upload ------------------------------------
if [[ "$UPLOAD" == true ]]; then
  if [[ -z "$AZURE_STORAGE_ACCOUNT" || -z "$AZURE_STORAGE_KEY" ]]; then
    warn "--upload specified but AZURE_STORAGE_ACCOUNT / AZURE_STORAGE_KEY are not set. Skipping upload."
  elif ! command -v az &>/dev/null; then
    warn "Azure CLI not installed. Skipping upload. Install with: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
  else
    info "Uploading to Azure Blob Storage..."
    az storage blob upload \
      --account-name "$AZURE_STORAGE_ACCOUNT" \
      --account-key  "$AZURE_STORAGE_KEY" \
      --container-name "$AZURE_STORAGE_CONTAINER" \
      --name "$(basename "$ARCHIVE")" \
      --file "$ARCHIVE" \
      --output none
    info "Upload complete: $AZURE_STORAGE_CONTAINER/$(basename "$ARCHIVE")"
  fi
fi

# ---------- Done --------------------------------------------------------------
info "============================================================"
info " Backup complete!"
info " File : $ARCHIVE"
info " Size : $ARCHIVE_SIZE"
info "============================================================"
