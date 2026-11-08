"""Alembic environment: connects with the migrate role; the version table lives in schema app."""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from app.db.engine import SCHEMA, migrate_url

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

COMMON = dict(
    target_metadata=None,          # migrations are written by hand (explicit SQL)
    version_table_schema=SCHEMA,
    include_schemas=True,
)


def run_migrations_offline() -> None:
    """`alembic upgrade head --sql`: print SQL, no connection."""
    context.configure(url=migrate_url().render_as_string(hide_password=True),
                      literal_binds=True, dialect_opts={"paramstyle": "named"}, **COMMON)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(migrate_url(), poolclass=NullPool, future=True)
    with engine.connect() as connection:
        context.configure(connection=connection, **COMMON)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
