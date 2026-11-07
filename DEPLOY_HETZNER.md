# Production Deployment & CI/CD Guide (Hetzner Cloud - Native)

This document provides a comprehensive, end-to-end explanation of the **Native, Non-Docker production architecture** and **GitHub Actions automated CI/CD pipeline** for the Muhurtham App on Hetzner Cloud.

---

## 1. Architecture Overview

Rather than running inside container abstractions (Docker), the app runs directly on the native Linux operating system using standard filesystem paths.

```
                  ┌──────────────────────────────────────────────┐
                  │              HETZNER CLOUD SERVER            │
                  │                                              │
Internet Traffic  │   ┌──────────────────────────────────────┐   │
(HTTP/HTTPS) ────┼──▶│   Caddy Reverse Proxy (Port 80/443)  │   │
                  │   │   - Automatic Let's Encrypt HTTPS    │   │
                  │   └──────────────────┬───────────────────┘   │
                  │                      │ proxy to 127.0.0.1:8000
                  │                      ▼                       │
                  │   ┌──────────────────────────────────────┐   │
                  │   │   Systemd Service (muhurtham.service)│   │
                  │   │   - Managed under user 'deploy'      │   │
                  │   │   - Runs Uvicorn (2 workers)         │   │
                  │   └──────────────────┬───────────────────┘   │
                  │                      │                       │
                  │                      ▼                       │
                  │   ┌──────────────────────────────────────┐   │
                  │   │   /var/www/muhurtham/                │   │
                  │   │   ├── backend/   (FastAPI API)       │   │
                  │   │   ├── webapp/    (HTML/CSS/JS UI)    │   │
                  │   │   ├── .venv/     (Python Virtualenv) │   │
                  │   │   └── muhurtham.db (SQLite Database) │   │
                  │   └──────────────────────────────────────┘   │
                  └──────────────────────────────────────────────┘
```

### Why This Native Setup?
1. **Direct Filesystem Storage**: The SQLite database (`muhurtham.db`) persists directly on the server's NVMe SSD and is never wiped during redeployments.
2. **Zero Cold Starts**: The service runs continuously 24/7 without idle timeouts or sleep cycles.
3. **Single Process Architecture**: FastAPI serves both the astronomical calculation API (`/api/`) and the static webapp (`webapp/`) from the exact same origin, eliminating CORS issues.
4. **Lowest Resource Footprint**: Without Docker overhead, the full application uses only ~300 MB of RAM, leaving ample capacity on an entry-level Hetzner instance.

---

## 2. Server Infrastructure & Security Model

The server uses the principle of **least privilege**:
- The application does **not** run as `root`.
- A dedicated system user `deploy` (`User=deploy`, `Group=deploy`) owns `/var/www/muhurtham` and executes the Python processes.
- Restricted `sudo` permissions in `/etc/sudoers.d/deploy` allow the `deploy` user to restart the application service and reload Caddy without requiring a root password or giving unrestricted root access to CI/CD.

---

## 3. Step-by-Step Initial Setup on Hetzner

Run these steps **once** on your Hetzner server to bootstrap the environment.

### Step 3.1: Connect to Server as Root
```bash
ssh root@<YOUR_HETZNER_IP>
```

### Step 3.2: Clone Repository into Production Directory
```bash
mkdir -p /var/www/muhurtham
cd /var/www/muhurtham
git clone https://github.com/<YOUR_ORG>/<YOUR_REPO>.git .
```

### Step 3.3: Run the Server Bootstrap Script
The repository includes an automated bootstrap script:
```bash
bash deploy/setup_hetzner.sh
```

**What this script does automatically:**
1. Installs Python 3, virtual environment tools, Git, curl, and the Caddy web server.
2. Creates the dedicated `deploy` system user and configures restricted sudoers rules.
3. Creates the `.venv` virtual environment in `/var/www/muhurtham/.venv`.
4. Installs Python packages from `backend/requirements.txt`.
5. Runs `backend/install_ephemeris.sh` to download and verify the Swiss Ephemeris (`.se1`) planetary data files.
6. Installs and starts the `muhurtham.service` systemd unit.
7. Installs the Caddy reverse proxy configuration.

---

## 4. SSH Key Pair Configuration for GitHub Actions

SSH uses an asymmetric key pair:
- **Private Key (`id_ed25519`)**: Kept secret inside GitHub Secrets. GitHub Actions uses this to prove its identity.
- **Public Key (`id_ed25519.pub`)**: Stored on the Hetzner server. It acts as the lock that the private key opens.

### Step 4.1: Generate a Dedicated Deployment Key Pair
On your local computer or on the server, run:
```bash
ssh-keygen -t ed25519 -C "github-actions-muhurtham" -f ./hetzner_deploy_key -N ""
```
This produces two files:
- `hetzner_deploy_key` (Private key)
- `hetzner_deploy_key.pub` (Public key)

### Step 4.2: Authorize the Public Key on Hetzner
Append the contents of `hetzner_deploy_key.pub` to the `deploy` user's authorized keys on the Hetzner server:
```bash
mkdir -p /home/deploy/.ssh
cat hetzner_deploy_key.pub >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

### Step 4.3: Add the Secrets to GitHub
In your GitHub repository:
1. Navigate to **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add the following:

| Secret Name | Description / Value |
| :--- | :--- |
| `HETZNER_HOST` | The public IPv4 address of your Hetzner server (e.g. `159.69.x.x`). |
| `HETZNER_USER` | `deploy` |
| `HETZNER_SSH_KEY` | Paste the **entire contents** of the private key `hetzner_deploy_key` (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`). |
| `HETZNER_PORT` | `22` (or your custom SSH port, optional, defaults to 22). |

---

## 5. How the Team CI/CD Pipeline Operates

The workflow file is located at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

```
 [ Team Member Pushes to main ]
               │
               ▼
 [ GitHub Actions: Deploy Job ]
   ├── Concurrency Control: Queues simultaneous team pushes
   ├── Connects via SSH as 'deploy' user
   │
   ▼
 [ Remote Server Execution (/var/www/muhurtham) ]
   ├── 1. git fetch origin main && git reset --hard origin/main
   │      (Guarantees conflict-free code sync with zero merge blocks)
   │
   ├── 2. source .venv/bin/activate && pip install -r backend/requirements.txt
   │      (Updates Python packages if dependencies changed)
   │
   ├── 3. bash backend/install_ephemeris.sh
   │      (Verifies Swiss Ephemeris planetary tables are complete)
   │
   ├── 4. sudo cp deploy/muhurtham.service /etc/systemd/system/
   │      sudo systemctl daemon-reload
   │      (Syncs any changes to service configuration)
   │
   ├── 5. sudo systemctl restart muhurtham
   │      (Restarts FastAPI server with updated code)
   │
   └── 6. Health Check: curl -f http://127.0.0.1:8000/health
          ├── SUCCESS: Notifies green build with commit SHA and author.
          └── FAILURE: Dumps last 30 journalctl logs directly into GitHub Actions.
```

### Team Protections Built In:
1. **No Merge Conflicts on Server**: Using `git reset --hard origin/main` ensures local file timestamp differences or untracked test files never cause `git pull` merge aborts. Ignored files (`muhurtham.db`, `.env`, `.venv/`) are untouched.
2. **Sequential Queueing**: `concurrency: { group: production-deployment, cancel-in-progress: false }` guarantees that if two team members merge PRs simultaneously, deployments execute in order without file locking collisions.
3. **Audit Trail**: Every deployment prints:
   ```text
   ==> Deploying commit e82a1b9 by <developer_username>...
   ```

---

## 6. Domain Name & HTTPS Configuration (Caddy)

Caddy automatically obtains and renews SSL/TLS certificates via Let's Encrypt with zero manual intervention.

### To Enable Your Custom Domain:
1. In your DNS registrar (Cloudflare, Namecheap, GoDaddy, etc.), create an **A Record**:
   - **Host / Name**: `@` (or `subdomain`)
   - **Points to / IP**: `<YOUR_HETZNER_IP>`
2. Edit [`deploy/Caddyfile`](deploy/Caddyfile):
   ```caddy
   yourdomain.com {
       reverse_proxy 127.0.0.1:8000
   }
   ```
3. Commit and push to `main` — the CI/CD pipeline will automatically update `/etc/caddy/Caddyfile` and reload Caddy on the server. HTTPS is now active.

---

## 7. Operational Runbook (Monitoring & Troubleshooting)

Commands to run on the Hetzner server when inspecting the running application:

### Check Application Status
```bash
sudo systemctl status muhurtham
```

### View Real-Time Application Logs
```bash
sudo journalctl -u muhurtham -f
```

### Manually Restart or Stop the Server
```bash
sudo systemctl restart muhurtham
sudo systemctl stop muhurtham
```

### Check Reverse Proxy (Caddy) Status & Logs
```bash
sudo systemctl status caddy
sudo journalctl -u caddy -f
```

### Test Internal Health Endpoint
```bash
curl http://127.0.0.1:8000/health
# Expected: {"status": "ok", "version": "0.1.0", "dev_pdf": false}
```

---

## 8. Rollback Procedure

If a bad commit is pushed by the team:
1. Revert the commit in Git locally or through the GitHub PR interface:
   ```bash
   git revert HEAD
   git push origin main
   ```
2. The GitHub Actions pipeline will instantly deploy the clean previous state and verify `/health`.

