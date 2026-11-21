"""User permission overrides (RBAC granular privileges).

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-21
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS app.user_permissions (
            user_id         UUID         NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
            permission_key  VARCHAR(80)  NOT NULL,
            is_enabled      BOOLEAN      NOT NULL,
            granted_by      UUID         REFERENCES app.users(id),
            granted_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
            reason          TEXT,
            PRIMARY KEY (user_id, permission_key)
        );
        CREATE INDEX IF NOT EXISTS user_permissions_user_id_idx
            ON app.user_permissions (user_id);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS app.user_permissions")

