# Deploying the Muhurtham App

## Architecture

```
                ┌─────────────────────────────────┐
     browser ──▶│  Single FastAPI server           │
                │  ├─ /            → webapp pages  │  (StaticFiles, html=True)
                │  ├─ /api routes  → panchang etc. │
                │  ├─ /files/*     → webapp assets │  (legacy alias)
                │  ├─ /static/*    → fonts bundle  │
                │  └─ /docs        → OpenAPI        │
                └─────────────────────────────────┘
                        ▲ only webapp/ + backend/ shipped
```

- **One server, one port.** The frontend (`webapp/`) is served by the same
  process that exposes the API — no CORS needed in default config, no CDN.
- **Origin-aware frontend.** `webapp/js/config.js` uses a relative API base
  whenever the page is served over http(s), so the same code works on
  localhost, a VM, or behind a reverse proxy at any domain.
- **file:// development still works** — `config.js` falls back to
  `http://127.0.0.1:8555` when the page is opened from disk.

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `MUHURTHAM_CORS_ORIGINS` | `*` | Comma-separated allowed origins. Set explicit domains in production; same-origin serving needs none. |
| `MUHURTHAM_ENABLE_DEV_PDF` | `0` | Exposes the dev-only `POST /dev/save-pdf`. Keep `0` in production. |
| `PORT` | `8000` | Server port. |
| `MUHURTHAM_WORKERS` | `2` | uvicorn worker processes. |

## Local (dev) run

```bash
./start_dev.sh          # uvicorn on 127.0.0.1:8555, dev PDF enabled
```

## Docker

```bash
docker compose up --build        # http://localhost:8000
```

or plain Docker:

```bash
docker build -t muhurtham .
docker run -p 8000:8000 \
  -e MUHURTHAM_CORS_ORIGINS="https://your.site.com" \
  muhurtham
```

## Behind nginx / reverse proxy

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Health

`GET /health` → `{"status": "ok", "version": "0.1.0", "dev_pdf": false}`

## What got deployed (and what didn't)

Shipped: `backend/app` + `webapp` (pages, css, js) + `backend/scripts`.
Not shipped (see `.dockerignore`): `.git`, PDFs, sqlite DB, docx sources,
the Flutter `frontend/` prototype.
