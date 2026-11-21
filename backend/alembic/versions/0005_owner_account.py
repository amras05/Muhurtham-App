"""The owner account: the super admin created from the server's terminal (user, 21 Nov 2026).

Nobody may delete, demote or disable it, not even another super admin, and the database itself refuses,
so a bug or a hand-written query cannot remove it either. Only one account can be the owner.

Backfill: the account named in the oldest "bootstrap.super_admin" activity-log row, or, if that row is gone
(log rows are kept one year), the only active super admin that no one created (created_by IS NULL), when
there is exactly one. Otherwise nobody is marked and the next `python -m app.auth.bootstrap --claim-owner`
marks it.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-21
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE app.users ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;
        CREATE UNIQUE INDEX IF NOT EXISTS users_one_owner ON app.users ((true)) WHERE is_owner;

        UPDATE app.users SET is_owner = true
        WHERE id = (
            SELECT COALESCE(
                (SELECT u.id FROM app.audit_logs l
                   JOIN app.users u ON u.id::text = l.target_id          -- text compare: other rows hold non-uuid ids
                  WHERE l.action = 'bootstrap.super_admin' AND u.role = 'super_admin' AND u.status = 'active'
                  ORDER BY l.created_at LIMIT 1),
                (SELECT u.id FROM app.users u
                  WHERE u.role = 'super_admin' AND u.status = 'active' AND u.created_by IS NULL
                    AND (SELECT count(*) FROM app.users x
                          WHERE x.role = 'super_admin' AND x.status = 'active' AND x.created_by IS NULL) = 1)
            )
        );

        CREATE OR REPLACE FUNCTION app.protect_owner() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                IF OLD.is_owner THEN
                    RAISE EXCEPTION 'The owner account cannot be deleted' USING ERRCODE = 'check_violation';
                END IF;
                RETURN OLD;
            END IF;
            IF OLD.is_owner AND (NOT NEW.is_owner OR NEW.role <> 'super_admin' OR NEW.status <> 'active') THEN
                RAISE EXCEPTION 'The owner account cannot be deleted, demoted or disabled'
                    USING ERRCODE = 'check_violation';
            END IF;
            RETURN NEW;
        END $$;

        DROP TRIGGER IF EXISTS users_protect_owner ON app.users;
        CREATE TRIGGER users_protect_owner BEFORE UPDATE OR DELETE ON app.users
            FOR EACH ROW EXECUTE FUNCTION app.protect_owner();
    """)


def downgrade() -> None:
    op.execute("""
        DROP TRIGGER IF EXISTS users_protect_owner ON app.users;
        DROP FUNCTION IF EXISTS app.protect_owner();
        DROP INDEX IF EXISTS app.users_one_owner;
        ALTER TABLE app.users DROP COLUMN IF EXISTS is_owner;
    """)
