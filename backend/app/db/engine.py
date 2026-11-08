"""
PostgreSQL connection for the app (Supabase in development, native PostgreSQL in production).

Built from the MUHURTHAM_DB_* settings (see backend/.env.example). On Supabase's pooler the
login name carries the project ref (`muhurtham_app.<ref>`); with no ref set it is used as is.

  app_engine()   the running app: role muhurtham_app (rows only), pooled
  migrate_url()  Alembic and one-off commands: role muhurtham_migrate (owns the tables)
"""
import os
from functools import lru_cache

from sqlalchemy import create_engine, event
from sqlalchemy.engine import URL, Engine

import app.core.config  # noqa: F401  (loads backend/.env before the settings are read)

SCHEMA = "app"


class DatabaseNotConfigured(RuntimeError):
    """A required MUHURTHAM_DB_* setting is missing."""


def _setting(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or str(value).strip() == "":
        raise DatabaseNotConfigured(f"{name} is not set (see backend/.env.example).")
    return str(value).strip()


def _url(role: str) -> URL:
    prefix = "MUHURTHAM_DB_APP" if role == "app" else "MUHURTHAM_DB_MIGRATE"
    user = _setting(f"{prefix}_USER")
    ref = os.environ.get("MUHURTHAM_DB_PROJECT_REF", "").strip()
    if ref and "." not in user:
        user = f"{user}.{ref}"
    return URL.create(
        "postgresql+psycopg",
        username=user,
        password=_setting(f"{prefix}_PASSWORD"),
        host=_setting("MUHURTHAM_DB_HOST"),
        port=int(_setting("MUHURTHAM_DB_PORT", "5432")),
        database=_setting("MUHURTHAM_DB_NAME", "postgres"),
        query={"sslmode": os.environ.get("MUHURTHAM_DB_SSLMODE", "require").strip() or "require",
               "application_name": "muhurtham"},
    )


def migrate_url() -> URL:
    return _url("migrate")


def _utc_on_connect(engine: Engine) -> None:
    @event.listens_for(engine, "connect")
    def _set_utc(dbapi_conn, _record):  # every new connection works in UTC
        with dbapi_conn.cursor() as cur:
            cur.execute("SET TIME ZONE 'UTC'")
        dbapi_conn.commit()


@lru_cache(maxsize=1)
def app_engine() -> Engine:
    """Pooled engine for the app role. Created on first use, shared by the worker."""
    engine = create_engine(
        _url("app"),
        pool_size=int(os.environ.get("MUHURTHAM_DB_POOL_SIZE", "3")),
        max_overflow=2,
        pool_pre_ping=True,        # replace connections the pooler has closed
        pool_recycle=1800,
        hide_parameters=True,      # never put query values (mobiles, hashes) into error messages or logs
        future=True,
    )
    _utc_on_connect(engine)
    return engine


def one_off_engine(role: str = "app") -> Engine:
    """Unpooled engine for scripts (bootstrap, import)."""
    from sqlalchemy.pool import NullPool
    engine = create_engine(_url(role), poolclass=NullPool, hide_parameters=True, future=True)
    _utc_on_connect(engine)
    return engine
