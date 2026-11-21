-- Migration: 0002_rbac
-- Creates: app.user_permissions
-- Role-level permissions use the existing app.app_settings table (key: "user_powers", "admin_powers")

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

COMMENT ON TABLE app.user_permissions IS
    'Per-user permission overrides. Role-level defaults live in app_settings as user_powers/admin_powers JSON.';

