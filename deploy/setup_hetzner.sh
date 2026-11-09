#!/usr/bin/env bash
# ==============================================================================
# Muhurtham App — Hetzner Server Bootstrap Script (Native, Non-Docker, Team-Ready)
# ==============================================================================
set -euo pipefail

echo "==> 1. Updating system packages and installing prerequisites..."
apt update && apt install -y \
    python3 \
    python3-venv \
    python3-pip \
    git \
    curl \
    sudo \
    debian-keyring \
    debian-archive-keyring \
    apt-transport-https \
    rsync \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0

# Install Caddy web server (for automatic SSL & reverse proxy)
if ! command -v caddy &> /dev/null; then
    echo "==> Installing Caddy..."
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt update && apt install -y caddy
fi

echo "==> 2. Creating dedicated 'deploy' system user (Security best practice)..."
if ! id -u deploy > /dev/null 2>&1; then
    useradd -m -s /bin/bash deploy
    mkdir -p /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    touch /home/deploy/.ssh/authorized_keys
    chmod 600 /home/deploy/.ssh/authorized_keys
    chown -R deploy:deploy /home/deploy/.ssh
    echo "==> User 'deploy' created."
fi

# Configure restricted sudo permissions for 'deploy' user (least-privilege)
cat << 'EOF' > /etc/sudoers.d/deploy
# Allow deploy user to manage only the muhurtham service and caddy without password
deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart muhurtham, /bin/systemctl reload caddy, /bin/systemctl daemon-reload, /bin/cp deploy/muhurtham.service /etc/systemd/system/muhurtham.service, /bin/cp deploy/Caddyfile /etc/caddy/Caddyfile, /usr/bin/journalctl -u muhurtham *
EOF
chmod 440 /etc/sudoers.d/deploy

echo "==> 3. Setting up project directories..."
APP_DIR="/var/www/muhurtham"
mkdir -p "$APP_DIR"

# Ensure deploy user owns the app directory
chown -R deploy:deploy "$APP_DIR"
cd "$APP_DIR"

if [ ! -d ".venv" ]; then
    echo "==> Creating Python 3 virtual environment..."
    sudo -u deploy python3 -m venv .venv
fi

echo "==> 4. Installing Python dependencies..."
sudo -u deploy bash -c "
    source .venv/bin/activate
    pip install --upgrade pip
    if [ -f 'backend/requirements.txt' ]; then
        pip install -r backend/requirements.txt
    fi
"

echo "==> 5. Installing Swiss Ephemeris data files..."
if [ -f "backend/install_ephemeris.sh" ]; then
    sudo -u deploy bash -c "
        source .venv/bin/activate
        bash backend/install_ephemeris.sh
    "
fi

echo "==> 6. Setting up systemd service..."
if [ -f "deploy/muhurtham.service" ]; then
    cp deploy/muhurtham.service /etc/systemd/system/muhurtham.service
    systemctl daemon-reload
    systemctl enable muhurtham
    systemctl restart muhurtham
    echo "==> muhurtham.service started and enabled!"
fi

echo "==> 6b. Nightly backup and clean-up timers (plan R7)..."
for unit in muhurtham-backup.service muhurtham-backup.timer muhurtham-cleanup.service muhurtham-cleanup.timer; do
    [ -f "deploy/$unit" ] && cp "deploy/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now muhurtham-backup.timer muhurtham-cleanup.timer || echo "   (timers start once /etc/muhurtham.env exists)"

echo "==> 7. Setting up Caddy reverse proxy..."
if [ -f "deploy/Caddyfile" ]; then
    cp deploy/Caddyfile /etc/caddy/Caddyfile
    systemctl reload caddy
fi

echo "=============================================================================="
echo " Setup complete!"
echo " IMPORTANT for Team CI/CD:"
echo " 1. Copy your GitHub Actions deploy SSH public key to: /home/deploy/.ssh/authorized_keys"
echo " 2. Verify service with: systemctl status muhurtham"
echo " 3. Verify health with:  curl http://127.0.0.1:8000/health"
echo " 4. Database: fill in /etc/muhurtham.env, then run: sudo bash deploy/setup_database.sh"
echo "    (full steps: deploy/RUNBOOK.md)"
echo "=============================================================================="
