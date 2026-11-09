#!/usr/bin/env bash
# ==============================================================================
# Muhurtham — database backup (plan R7). Run nightly by muhurtham-backup.timer and before
# every deploy. Writes a compressed pg_dump, keeps MUHURTHAM_BACKUP_KEEP_DAYS days, and copies it
# off the server when MUHURTHAM_BACKUP_REMOTE is set (decision H2).
#   sudo -u deploy bash /var/www/muhurtham/deploy/backup.sh
# Restore (into an EMPTY database):  pg_restore --no-owner -d muhurtham <file>.dump   (see RUNBOOK)
# ==============================================================================
set -euo pipefail
set -a; . /etc/muhurtham.env; set +a

DIR="${MUHURTHAM_BACKUP_DIR:-/var/backups/muhurtham}"
KEEP="${MUHURTHAM_BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
FILE="$DIR/muhurtham_$STAMP.dump"
mkdir -p "$DIR"
umask 077

# The migrate role owns every table, so its dump is complete. The password goes through the
# environment of this one command only (never on the command line or in the log).
PGPASSWORD="$MUHURTHAM_DB_MIGRATE_PASSWORD" pg_dump -Fc \
  -h "${MUHURTHAM_DB_HOST:-127.0.0.1}" -p "${MUHURTHAM_DB_PORT:-5432}" \
  -U "$MUHURTHAM_DB_MIGRATE_USER" -d "$MUHURTHAM_DB_NAME" -n "${MUHURTHAM_DB_SCHEMA:-app}" -f "$FILE"
pg_restore --list "$FILE" > /dev/null          # the file must be readable, or the backup failed
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"

find "$DIR" -name 'muhurtham_*.dump' -mtime +"$KEEP" -delete

if [ -n "${MUHURTHAM_BACKUP_REMOTE:-}" ]; then
  rsync -a --delete -e "ssh -p 23 -o BatchMode=yes" "$DIR/" "$MUHURTHAM_BACKUP_REMOTE/"
  echo "Copied off the server to $MUHURTHAM_BACKUP_REMOTE"
else
  echo "WARNING: MUHURTHAM_BACKUP_REMOTE is empty; backups exist only on this server." >&2
fi
