#!/usr/bin/env bash
# ==============================================================================
# Muhurtham App — Hetzner Server Bootstrap Script (Native, Non-Docker)
# ==============================================================================
set -euo pipefail

echo "==> 1. Updating system packages and installing prerequisites..."
apt update && apt install -y \
    python3 \
    python3-venv \
    python3-pip \
    git \
    curl \
    debian-keyring \
    debian-archive-keyring \
    apt-transport-https

# Install Caddy web server (for automatic SSL & reverse proxy)
if ! command -v caddy &> /dev/null; then
    echo "==> Installing Caddy..."
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt update && apt install -y caddy
fi

echo "==> 2. Setting up project directories..."
APP_DIR="/var/www/muhurtham"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -d ".venv" ]; then
    echo "==> Creating Python 3 virtual environment..."
    python3 -m venv .venv
fi

echo "==> 3. Installing Python dependencies..."
source .venv/bin/activate
pip install --upgrade pip
if [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
fi

echo "==> 4. Installing Swiss Ephemeris data files..."
if [ -f "backend/install_ephemeris.sh" ]; then
    bash backend/install_ephemeris.sh
fi

echo "==> 5. Setting up systemd service..."
if [ -f "deploy/muhurtham.service" ]; then
    cp deploy/muhurtham.service /etc/systemd/system/muhurtham.service
    systemctl daemon-reload
    systemctl enable muhurtham
    systemctl restart muhurtham
    echo "==> muhurtham.service started and enabled!"
fi

echo "==> 6. Setting up Caddy reverse proxy..."
if [ -f "deploy/Caddyfile" ]; then
    cp deploy/Caddyfile /etc/caddy/Caddyfile
    systemctl reload caddy
fi

echo "=============================================================================="
echo " Setup complete! Verify with: systemctl status muhurtham"
echo " Health check: curl http://127.0.0.1:8000/health"
echo "=============================================================================="

