"""Alert bell remembered per account (plan F2, approved as M4 on 9 Nov 2026).

users.alerts_seen_at: when the person last opened the alert bell, so the unread count follows the
account across browsers and devices instead of being kept in one browser.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-09
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE app.users ADD COLUMN alerts_seen_at timestamptz")


def downgrade() -> None:
    op.execute("ALTER TABLE app.users DROP COLUMN IF EXISTS alerts_seen_at")
