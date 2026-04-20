# ================================================================
# CityU Research Review Portal — Docker helper commands
# ================================================================
.DEFAULT_GOAL := help

.PHONY: help up down init logs shell build rebuild \
        db-export db-import db-shell reset url

help:  ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ── Container lifecycle ─────────────────────────────────────────────

up:    ## Start all containers in the background
	docker compose up -d
	@echo ""
	@echo "Containers starting. Wait ~30 s then run 'make init' if first time."

down:  ## Stop all containers (data is preserved in volumes)
	docker compose down

build: ## Build the WordPress image (run after Dockerfile changes)
	docker compose build wordpress

rebuild: ## Force-rebuild the image from scratch
	docker compose build --no-cache wordpress

# ── First-time setup ────────────────────────────────────────────────

init:  ## Install WordPress + activate plugin (run ONCE after 'make up')
	docker compose exec wordpress bash /usr/local/bin/docker-init.sh

# ── Day-to-day dev ──────────────────────────────────────────────────

logs:  ## Tail WordPress (Apache/PHP) logs
	docker compose logs -f wordpress

shell: ## Open a bash shell inside the WordPress container
	docker compose exec wordpress bash

url:   ## Print the portal URL (from .env / default)
	@echo "Portal: $${WP_URL:-http://localhost:8080}"
	@echo "Admin:  $${WP_URL:-http://localhost:8080}/wp-admin"

# ── Database ────────────────────────────────────────────────────────

db-export: ## Export DB → data/rrp-db-export.sql
	@mkdir -p data
	docker compose exec db \
	  mysqldump -u wp --password=$${DB_PASSWORD:-wp_test_pass} wordpress \
	  > data/rrp-db-export.sql
	@echo "Exported to data/rrp-db-export.sql"

db-import: ## Import data/rrp-db-export.sql into the running container
	docker compose exec -T db \
	  mysql -u wp --password=$${DB_PASSWORD:-wp_test_pass} wordpress \
	  < data/rrp-db-export.sql
	@echo "Database imported."

db-shell: ## Open a MySQL shell in the db container
	docker compose exec db mysql -u wp --password=$${DB_PASSWORD:-wp_test_pass} wordpress

# ── Reset ───────────────────────────────────────────────────────────

reset: ## ⚠ Destroy ALL volumes (db + wp files) and restart fresh
	@echo "WARNING: This will delete all WordPress data and the database."
	@read -p "Type 'yes' to confirm: " CONFIRM && [ "$$CONFIRM" = "yes" ]
	docker compose down -v
	docker compose up -d
	@echo "Volumes destroyed. Run 'make init' to reinstall."
