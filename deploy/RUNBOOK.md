# Muhurtham on the Hetzner server — runbook

The site runs natively (no Docker): the `muhurtham` systemd service (uvicorn, 2 workers on
127.0.0.1:8000) behind Caddy on port 80, PostgreSQL 17 on the same machine, deployed by the
GitHub workflow on every push to `main`.

**No domain yet:** the site is opened as `http://<server-ip>`. Without a domain there is no
HTTPS, so `MUHURTHAM_COOKIE_SECURE=0` lets logins work over plain HTTP. **Known risk:**
passwords and login cookies travel unencrypted. When a domain is ready, see step 9.

Commands below are run on the server over SSH unless marked *(your laptop)*.

---

## 1. First-time server set-up (root)

```bash
cd /var/www/muhurtham            # the repository, cloned here (owned by the deploy user)
sudo bash deploy/setup_hetzner.sh
```

Installs Python, Caddy, Pango (for PDFs), the `deploy` user, the app service, and the
nightly backup and clean-up timers.

## 2. Settings file with new secrets

```bash
sudo cp deploy/muhurtham.env.example /etc/muhurtham.env
sudo chown root:deploy /etc/muhurtham.env && sudo chmod 640 /etc/muhurtham.env
sudo nano /etc/muhurtham.env
```

Fill in every empty value. Each line explains how to generate it. Use **new** values, never
the development ones from `backend/.env`. Store `MUHURTHAM_DATA_KEY` and both database
passwords in your password manager: without the data key, saved birth details can't be opened.

## 3. Database (root)

```bash
sudo bash deploy/setup_database.sh
```

Installs PostgreSQL 17 (listening on localhost only), creates the `muhurtham` database, the
`app` schema and the two roles from your settings file, then runs `alembic upgrade head`
(revision 0002). Safe to run again.

## 4. Start the app

```bash
sudo systemctl restart muhurtham
curl -f http://127.0.0.1:8000/health          # {"status":"ok", ...}
sudo journalctl -u muhurtham -n 30 --no-pager  # look for errors
```

Open `http://<server-ip>/` in a browser: you should get the login page.

## 5. WhatsApp check

Sign in later as super admin → **Settings → Notifications → Send a test code to my WhatsApp**.
If it fails, check the three `MUHURTHAM_WHATSAPP_*` values and restart the service.

## 6. First super admin (once)

```bash
sudo -u deploy bash -c 'set -a; . /etc/muhurtham.env; set +a; cd /var/www/muhurtham/backend && \
  ../.venv/bin/python -m app.auth.bootstrap --mobile +91XXXXXXXXXX --name "Your Name"'
```

It asks for the super admin's password twice (at least 10 characters; nothing is shown as you
type). Then log in at `http://<server-ip>/` with that number and password.

## 7. Backups

- Nightly at 02:30 (`muhurtham-backup.timer`), and before every deploy. Kept 14 days in
  `/var/backups/muhurtham`.
- **Off-server copy (decision H2, still open):** set `MUHURTHAM_BACKUP_REMOTE` in
  `/etc/muhurtham.env` (for example a Hetzner Storage Box) and add the deploy user's SSH key
  there. Until then backups live only on this server.
- Run one now and check it:

```bash
sudo -u deploy bash /var/www/muhurtham/deploy/backup.sh
ls -lh /var/backups/muhurtham
```

- **Test a restore once before launch** (into a scratch database, never the live one):

```bash
sudo -u postgres createdb muhurtham_restore_test
sudo -u postgres pg_restore --no-owner -d muhurtham_restore_test /var/backups/muhurtham/<file>.dump
sudo -u postgres psql -d muhurtham_restore_test -c "SELECT count(*) FROM app.users;"
sudo -u postgres dropdb muhurtham_restore_test
```

## 8. Everyday operation

| What | Command |
|---|---|
| App status / logs | `systemctl status muhurtham` · `sudo journalctl -u muhurtham -f` |
| Timers | `systemctl list-timers 'muhurtham-*'` |
| Clean-up by hand | `sudo systemctl start muhurtham-cleanup` (counts are in its journal) |
| Deploy | push to `main` *(your laptop)*: the workflow backs up, migrates, restarts, checks health |
| Roll back code | revert the commit and push; migrations are not undone automatically |

The deploy stops before restarting if the backup or a migration fails, so the old version
keeps running. Read the GitHub Actions log, fix, and push again.

## 9. When you get a domain (later)

1. Point the domain's A record at the server IP.
2. In `deploy/Caddyfile`, use Option A with the domain (and remove the `:80` block). Push.
3. In `/etc/muhurtham.env` set `MUHURTHAM_COOKIE_SECURE=1`, then
   `sudo systemctl restart muhurtham`. Everyone logs in again once.

## Not covered here

Firewall rules (allow 22 and 80, plus 443 once there is HTTPS) are set in the Hetzner Cloud
console. Server OS updates: `sudo apt update && sudo apt upgrade` monthly.
