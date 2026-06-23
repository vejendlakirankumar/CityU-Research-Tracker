#!/usr/bin/env bash
# Remote background installer - triggered via nohup so SSH disconnection doesn't kill it
# Logs all output to /tmp/rrp-install.log
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

LOG=/tmp/rrp-install.log
exec > >(tee -a "$LOG") 2>&1

echo "=== RRP Remote Installer started at $(date) ==="
echo "=== Running as: $(whoami), on $(hostname) ==="

# --- Extract uploaded zip to /opt/rrp ---
echo "=== Extracting source files ==="
rm -rf /opt/rrp
mkdir -p /opt/rrp
cd /tmp
rm -rf rrp-src
mkdir rrp-src
cd rrp-src
unzip -q /tmp/rrp-deploy.zip
cp -r . /opt/rrp/

# --- Run the bare-metal installer ---
echo "=== Starting install.sh ==="
bash /opt/rrp/deploy/install.sh \
  --domain rrp.westus3.cloudapp.azure.com \
  --email admin@cityu.edu

echo "=== DEPLOYMENT COMPLETE at $(date) ==="
