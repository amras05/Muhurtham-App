"""
Muhurtham App — centralized configuration.

All settings are loaded from environment variables with safe defaults
for local development.  Production deployments should set the env vars
explicitly (via Docker env, .env file, or cloud config).
"""
import logging
import os
import secrets
from pathlib import Path

from app.core.env import load_env_file

# backend/.env (git-ignored) for local development; real environment variables win.
load_env_file()

# ── Paths ──────────────────────────────────────────────────────
_CURRENT_FILE = Path(__file__).resolve()
# Root of backend/
BACKEND_DIR = _CURRENT_FILE.parent.parent.parent
# Root of workspace (Muhurtham-App/)
WORKSPACE_DIR = BACKEND_DIR.parent
# Root of webapp/ (static frontend served by FastAPI)
WEBAPP_DIR = WORKSPACE_DIR / "webapp"
# Static assets inside app/ (fonts, etc.)
APP_STATIC_DIR = _CURRENT_FILE.parent.parent / "static"

# ── CORS ───────────────────────────────────────────────────────
# Comma-separated origins, "*" for all (dev only).
_CORS_ENV = os.environ.get("MUHURTHAM_CORS_ORIGINS", "*")
CORS_ORIGINS: list[str] = [o.strip() for o in _CORS_ENV.split(",") if o.strip()]

# ── Auth / Security ───────────────────────────────────────────
# development | production
APP_ENV: str = os.environ.get("MUHURTHAM_ENV", "development").strip().lower()

# Signs login tokens. There is no default in the code: production refuses to start
# without it; development falls back to a random key per start (everyone is logged
# out on restart) and says so.
SECRET_KEY: str = os.environ.get("MUHURTHAM_SECRET_KEY", "").strip()
if len(SECRET_KEY) < 32:
    if APP_ENV == "production":
        raise RuntimeError("MUHURTHAM_SECRET_KEY must be set (at least 32 characters) in production.")
    SECRET_KEY = secrets.token_hex(32)
    logging.getLogger("muhurtham.config").warning(
        "MUHURTHAM_SECRET_KEY is not set; using a temporary key. Logins end when the server restarts."
    )

# ── Feature Flags ─────────────────────────────────────────────
# Dev-only PDF save endpoint: enabled explicitly, disabled in deployments.
ENABLE_DEV_PDF: bool = os.environ.get("MUHURTHAM_ENABLE_DEV_PDF", "0") == "1"

# ── App Metadata ──────────────────────────────────────────────
APP_TITLE = "Muhurta Finder API"
APP_VERSION = "0.1.0"


class Settings:
    BACKEND_DIR = BACKEND_DIR
    BASE_DIR = BACKEND_DIR
    WEBAPP_DIR = WEBAPP_DIR
    APP_STATIC_DIR = APP_STATIC_DIR
    CORS_ORIGINS = CORS_ORIGINS
    SECRET_KEY = SECRET_KEY
    APP_ENV = APP_ENV
    ENABLE_DEV_PDF = ENABLE_DEV_PDF
    APP_TITLE = APP_TITLE
    APP_VERSION = APP_VERSION


_settings = Settings()


def get_settings() -> Settings:
    return _settings

