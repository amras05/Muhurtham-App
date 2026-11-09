#!/usr/bin/env bash
# ==============================================================================
# Muhurtham — one-time PostgreSQL 17 set-up on the Hetzner server (plan R7)
# Run as root AFTER deploy/setup_hetzner.sh and AFTER /etc/muhurtham.env is filled in:
#   sudo bash deploy/setup_database.sh
# Safe to run again: existing database, roles and migrations are kept.
# ==============================================================================
set -euo pipefail

APP_DIR="/var/www/muhurtham"
ENV_FILE="/etc/muhurtham.env"
PG_MAJOR=17                       # same major version as the Supabase development database

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy deploy/muhurtham.env.example there and fill it in first." >&2
  exit 1
fi
set -a; . "$ENV_FILE"; set +a
for v in MUHURTHAM_DB_NAME MUHURTHAM_DB_APP_PASSWORD MUHURTHAM_DB_MIGRATE_PASSWORD MUHURTHAM_SECRET_KEY MUHURTHAM_DATA_KEY; do
  if [ -z "${!v:-}" ]; then echo "$v is empty in $ENV_FILE" >&2; exit 1; fi
done

echo "==> 1. Installing PostgreSQL $PG_MAJOR (official PostgreSQL apt repository)..."
if ! command -v "/usr/lib/postgresql/$PG_MAJOR/bin/postgres" > /dev/null 2>&1; then
  apt update && apt install -y curl ca-certificates postgresql-common
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  apt install -y "postgresql-$PG_MAJOR"
fi
systemctl enable --now postgresql

echo "==> 2. Listening on this machine only (port 5432 is never opened to the internet)..."
PG_CONF="/etc/postgresql/$PG_MAJOR/main/postgresql.conf"
if ! grep -q "^listen_addresses = 'localhost'" "$PG_CONF"; then
  echo "listen_addresses = 'localhost'" >> "$PG_CONF"
  systemctl restart postgresql
fi

echo "==> 3. Creating the database..."
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$MUHURTHAM_DB_NAME'" | grep -q 1; then
  sudo -u postgres createdb "$MUHURTHAM_DB_NAME"
fi

echo "==> 4. Creating the schema and roles (passwords from $ENV_FILE, sent as SCRAM verifiers)..."
"$APP_DIR/.venv/bin/python" "$APP_DIR/backend/scripts/pg_roles.py" --env "$ENV_FILE" \
  | sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$MUHURTHAM_DB_NAME"

echo "==> 5. Creating the tables (Alembic migrations, as the migrate role)..."
chown root:deploy "$ENV_FILE"; chmod 640 "$ENV_FILE"        # the app user may read it; nobody else
sudo -u deploy bash -c "set -a; . '$ENV_FILE'; set +a; cd '$APP_DIR/backend' && '$APP_DIR/.venv/bin/alembic' upgrade head"

echo "==> 6. Backup folder..."
mkdir -p "${MUHURTHAM_BACKUP_DIR:-/var/backups/muhurtham}"
chown deploy:deploy "${MUHURTHAM_BACKUP_DIR:-/var/backups/muhurtham}"
chmod 700 "${MUHURTHAM_BACKUP_DIR:-/var/backups/muhurtham}"

echo "=============================================================================="
echo " Database ready. Next:"
echo "  1. Restart the app:            sudo systemctl restart muhurtham"
echo "  2. Create the super admin:     see deploy/RUNBOOK.md, step 6"
echo "  3. Take a first backup:        sudo -u deploy bash $APP_DIR/deploy/backup.sh"
echo "=============================================================================="
