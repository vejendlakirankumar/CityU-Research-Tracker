#!/bin/bash
# /opt/rrp-v2/deploy/watchdog.sh
# Called by supervisor every cycle. Sleeps 60 s, then checks the health endpoint.
# If unhealthy, restarts the docker compose stack via supervisorctl.
sleep 60
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 http://localhost/api/system/public 2>/dev/null)

if [ "$HTTP_STATUS" != "200" ]; then
    echo "[$(date -u +%FT%TZ)] Health check failed (HTTP $HTTP_STATUS) — restarting rrp-v2-stack"
    supervisorctl restart rrp-v2-stack
fi
