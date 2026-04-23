#!/bin/bash
set -e
echo "=== Building frontend ==="
docker run --rm -v /opt/rrp-v2/frontend-src:/app -w /app node:20-alpine sh -c "npm ci && npm run build"
echo "=== Copying dist ==="
docker cp /opt/rrp-v2/frontend-src/dist/. rrp_app:/var/www/frontend/
echo "=== Reloading nginx ==="
docker exec rrp_app nginx -s reload
echo "=== Done ==="
