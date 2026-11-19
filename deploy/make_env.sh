#!/usr/bin/env bash
# ==============================================================================
# Muhurtham: make /etc/muhurtham.env on the server, with NEW random secrets (19 Nov 2026).
#   sudo bash deploy/make_env.sh
# It generates the two database passwords, the signing key and the data key here on the server, so they
# never pass through Git or a laptop. It asks only for the domain and the WhatsApp values (each may be
# left empty and filled in later). It refuses to overwrite an existing file: the data key in it decrypts
# saved birth details, and replacing it would make them unreadable.
# ==============================================================================
set -euo pipefail

ENV_FILE="/etc/muhurtham.env"
if [ "$(id -u)" -ne 0 ]; then echo "Run as root: sudo bash deploy/make_env.sh" >&2; exit 1; fi
if [ -e "$ENV_FILE" ]; then
  echo "$ENV_FILE already exists; nothing changed." >&2
  echo "Its MUHURTHAM_DATA_KEY decrypts saved birth details, so it is never replaced by this script." >&2
  exit 1
fi
if ! id -u deploy > /dev/null 2>&1; then echo "The 'deploy' user is missing. Run deploy/setup_hetzner.sh first." >&2; exit 1; fi

rand_pw()  { python3 -c "import secrets; print(secrets.token_urlsafe(32))"; }
rand_hex() { python3 -c "import secrets; print(secrets.token_hex(32))"; }
rand_key() { python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"; }

echo "Leave any answer empty to fill it in later with: sudo nano $ENV_FILE"
read -r -p "Domain without https:// (e.g. muhurtham.example.com; empty = testing by IP over plain HTTP): " DOMAIN
read -r -p "WhatsApp phone number ID (Meta): " WA_PHONE_ID
read -r -s -p "WhatsApp access token (Meta; nothing shows as you type): " WA_TOKEN; echo
read -r -p "WhatsApp template name [otp_verification]: " WA_TEMPLATE
WA_TEMPLATE="${WA_TEMPLATE:-otp_verification}"
read -r -p "Off-server backup target, e.g. u123456@u123456.your-storagebox.de:muhurtham (empty = none yet): " BACKUP_REMOTE

if [ -n "$DOMAIN" ]; then COOKIE_SECURE=1; CORS="https://$DOMAIN"; else COOKIE_SECURE=0; CORS=""; fi

umask 077
cat > "$ENV_FILE" <<CONF
# Muhurtham production settings, made by deploy/make_env.sh on $(date +%Y-%m-%d).
# Secrets below were generated on this server. Copy MUHURTHAM_DATA_KEY and both database passwords
# into your password manager now: without the data key, saved birth details can't be opened.
# Never commit this file. Reference for every line: deploy/muhurtham.env.example

MUHURTHAM_ENV=production

MUHURTHAM_DB_HOST=127.0.0.1
MUHURTHAM_DB_PORT=5432
MUHURTHAM_DB_NAME=muhurtham
MUHURTHAM_DB_SCHEMA=app
MUHURTHAM_DB_SSLMODE=disable
MUHURTHAM_DB_APP_USER=muhurtham_app
MUHURTHAM_DB_APP_PASSWORD=$(rand_pw)
MUHURTHAM_DB_MIGRATE_USER=muhurtham_migrate
MUHURTHAM_DB_MIGRATE_PASSWORD=$(rand_pw)
MUHURTHAM_DB_POOL_SIZE=3

MUHURTHAM_SECRET_KEY=$(rand_hex)
MUHURTHAM_DATA_KEY=$(rand_key)

# 1 = login cookies only over HTTPS (needs the domain). 0 = testing by IP over plain HTTP (unsafe for real users).
MUHURTHAM_COOKIE_SECURE=$COOKIE_SECURE
MUHURTHAM_CORS_ORIGINS=$CORS

MUHURTHAM_WHATSAPP_TOKEN=$WA_TOKEN
MUHURTHAM_WHATSAPP_PHONE_NUMBER_ID=$WA_PHONE_ID
MUHURTHAM_WHATSAPP_TEMPLATE=$WA_TEMPLATE
MUHURTHAM_OTP_DEV_ECHO=0

MUHURTHAM_BACKUP_DIR=/var/backups/muhurtham
MUHURTHAM_BACKUP_KEEP_DAYS=14
MUHURTHAM_BACKUP_REMOTE=$BACKUP_REMOTE
CONF

chown root:deploy "$ENV_FILE"
chmod 640 "$ENV_FILE"

echo
echo "Written: $ENV_FILE (owner root:deploy, mode 640)"
echo "Next:"
echo "  1. Save the secrets in your password manager:  sudo grep -E 'DATA_KEY|PASSWORD' $ENV_FILE"
[ -z "$DOMAIN" ] && echo "  2. No domain yet: when you have one, set MUHURTHAM_COOKIE_SECURE=1 and MUHURTHAM_CORS_ORIGINS=https://<domain>"
[ -z "$WA_TOKEN" ] && echo "  -  WhatsApp is empty: sign-up and password reset codes won't send until it is filled in"
echo "  3. Create the database:  sudo bash deploy/setup_database.sh"
