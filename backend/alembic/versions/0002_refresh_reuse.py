"""Refresh-token reuse detection (plan R5, approved as M3 on 9 Nov 2026).

sessions.previous_refresh_hash keeps the hash of the refresh token a session last swapped away.
If that old token is presented again, someone copied it: every session of that person is signed out.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-09
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

UPGRADE = [
    "ALTER TABLE app.sessions ADD COLUMN previous_refresh_hash text",
    """CREATE INDEX sessions_prev_refresh_idx ON app.sessions (previous_refresh_hash)
       WHERE previous_refresh_hash IS NOT NULL""",
]

DOWNGRADE = [
    "DROP INDEX IF EXISTS app.sessions_prev_refresh_idx",
    "ALTER TABLE app.sessions DROP COLUMN IF EXISTS previous_refresh_hash",
]


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)
