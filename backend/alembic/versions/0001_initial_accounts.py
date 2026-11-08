"""Accounts foundation: users, OTP, sessions, rate limits, family, saved searches, audit,
settings, omen calendar, announcements (accounts plan, Tables tab; approved as A1).

Revision ID: 0001
Revises:
Create Date: 2026-11-08
"""
import os

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# The role the running app uses (may not edit the audit log).
APP_ROLE = os.environ.get("MUHURTHAM_DB_APP_USER", "muhurtham_app").split(".")[0]

E164 = r"'^\+[1-9][0-9]{7,14}$'"

UPGRADE = [
    # ── helper ─────────────────────────────────────────────────────────────
    """
    CREATE FUNCTION app.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END $$
    """,

    # ── users ──────────────────────────────────────────────────────────────
    f"""
    CREATE TABLE app.users (
      id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile             text        UNIQUE,
      mobile_verified_at timestamptz,
      name               text        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
      email              text        UNIQUE CHECK (email = lower(email)),
      password_hash      text,
      role               text        NOT NULL DEFAULT 'user'   CHECK (role IN ('user','admin','super_admin')),
      status             text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','deleted')),
      disabled_reason    text,
      preferred_language text        NOT NULL DEFAULT 'te' CHECK (preferred_language IN ('te','en')),
      home_place         text,
      home_lat           numeric(9,6),
      home_lon           numeric(9,6),
      home_tz            numeric(4,2),
      consent_version    text,
      consent_at         timestamptz,
      failed_logins      smallint    NOT NULL DEFAULT 0,
      locked_until       timestamptz,
      login_count        integer     NOT NULL DEFAULT 0,
      last_login_at      timestamptz,
      created_by         uuid        REFERENCES app.users (id) ON DELETE SET NULL,
      created_at         timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now(),
      deleted_at         timestamptz,
      CONSTRAINT users_mobile_required CHECK (status = 'deleted' OR mobile IS NOT NULL),
      CONSTRAINT users_mobile_format   CHECK (mobile ~ {E164}),
      CONSTRAINT users_active_verified CHECK (status <> 'active' OR mobile_verified_at IS NOT NULL)
    )
    """,
    "CREATE INDEX users_role_status_idx ON app.users (role, status)",
    "CREATE INDEX users_created_idx ON app.users (created_at)",
    "CREATE TRIGGER users_touch BEFORE UPDATE ON app.users FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()",

    # ── otp_requests ───────────────────────────────────────────────────────
    """
    CREATE TABLE app.otp_requests (
      id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile      text        NOT NULL,
      purpose     text        NOT NULL CHECK (purpose IN ('signup','login','reset_password','change_mobile')),
      code_hash   text        NOT NULL,
      channel     text        NOT NULL CHECK (channel IN ('whatsapp','sms')),
      attempts    smallint    NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
      expires_at  timestamptz NOT NULL,
      consumed_at timestamptz,
      ip_address  inet,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX otp_mobile_created_idx ON app.otp_requests (mobile, created_at DESC)",
    "CREATE INDEX otp_ip_created_idx ON app.otp_requests (ip_address, created_at DESC)",

    # ── sessions, rate_limits ──────────────────────────────────────────────
    """
    CREATE TABLE app.sessions (
      id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      uuid        NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
      refresh_hash text        NOT NULL UNIQUE,
      device_label text,
      user_agent   text,
      ip_address   inet,
      created_at   timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz,
      expires_at   timestamptz NOT NULL,
      revoked_at   timestamptz
    )
    """,
    "CREATE INDEX sessions_user_active_idx ON app.sessions (user_id) WHERE revoked_at IS NULL",
    """
    CREATE TABLE app.rate_limits (
      bucket       text        NOT NULL,
      window_start timestamptz NOT NULL,
      hits         integer     NOT NULL DEFAULT 0,
      PRIMARY KEY (bucket, window_start)
    )
    """,

    # ── family_profiles ────────────────────────────────────────────────────
    f"""
    CREATE TABLE app.family_profiles (
      id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id           uuid        NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
      display_name       text        NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
      relation           text        NOT NULL CHECK (relation IN ('self','spouse','son','daughter','father',
                                       'mother','brother','sister','grandchild','other')),
      gender             text        CHECK (gender IN ('male','female')),
      mobile             text        CHECK (mobile ~ {E164}),
      birth_enc          bytea,
      birth_time_unknown boolean     NOT NULL DEFAULT false,
      janma_nak          smallint    CHECK (janma_nak   BETWEEN 1 AND 27),
      janma_pada         smallint    CHECK (janma_pada  BETWEEN 1 AND 4),
      janma_rasi         smallint    CHECK (janma_rasi  BETWEEN 1 AND 12),
      birth_lagna        smallint    CHECK (birth_lagna BETWEEN 1 AND 12),
      nama_nak           smallint    CHECK (nama_nak    BETWEEN 1 AND 27),
      nama_pada          smallint    CHECK (nama_pada   BETWEEN 1 AND 4),
      star_source        text        CHECK (star_source IN ('picked','name','birth')),
      gotra              text,
      is_eldest          boolean     NOT NULL DEFAULT false,
      created_at         timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now(),
      deleted_at         timestamptz
    )
    """,
    """CREATE UNIQUE INDEX family_one_self_idx ON app.family_profiles (owner_id)
       WHERE relation = 'self' AND deleted_at IS NULL""",
    "CREATE INDEX family_owner_idx ON app.family_profiles (owner_id) WHERE deleted_at IS NULL",
    "CREATE TRIGGER family_touch BEFORE UPDATE ON app.family_profiles FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()",

    # ── saved_searches, family_events ──────────────────────────────────────
    """
    CREATE TABLE app.saved_searches (
      id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id           uuid        NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
      kind               text        NOT NULL CHECK (kind IN ('muhurta','yogas','pitru')),
      activity_id        text,
      label              text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
      request_json       jsonb       NOT NULL,
      chosen_window_json jsonb,
      engine_version     text        NOT NULL,
      is_favourite       boolean     NOT NULL DEFAULT false,
      created_at         timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX saved_owner_idx ON app.saved_searches (owner_id, is_favourite, created_at DESC)",
    "CREATE TRIGGER saved_touch BEFORE UPDATE ON app.saved_searches FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()",
    """
    CREATE TABLE app.family_events (
      id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id        uuid        NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
      profile_id      uuid        NOT NULL REFERENCES app.family_profiles (id) ON DELETE CASCADE,
      activity_id     text        NOT NULL,
      event_date      date        NOT NULL,
      event_time      time,
      status          text        NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','cancelled')),
      saved_search_id uuid        REFERENCES app.saved_searches (id) ON DELETE SET NULL,
      notes           text        CHECK (char_length(notes) <= 500),
      created_at      timestamptz NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX events_owner_date_idx ON app.family_events (owner_id, event_date)",
    "CREATE INDEX events_activity_idx ON app.family_events (owner_id, activity_id, event_date)",

    # ── audit_logs ─────────────────────────────────────────────────────────
    """
    CREATE TABLE app.audit_logs (
      id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      actor_id     uuid        REFERENCES app.users (id) ON DELETE SET NULL,
      actor_role   text,
      action       text        NOT NULL,
      target_type  text,
      target_id    text,
      details_json jsonb,
      ip_address   inet,
      user_agent   text,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX audit_actor_idx ON app.audit_logs (actor_id, created_at DESC)",
    "CREATE INDEX audit_target_idx ON app.audit_logs (target_id)",
    "CREATE INDEX audit_action_idx ON app.audit_logs (action, created_at DESC)",
    f"REVOKE UPDATE, DELETE ON app.audit_logs FROM {APP_ROLE}",

    # ── app_settings, utpata_events, announcements ─────────────────────────
    """
    CREATE TABLE app.app_settings (
      setting_key text        PRIMARY KEY,
      value_json  jsonb       NOT NULL,
      updated_by  uuid        REFERENCES app.users (id) ON DELETE SET NULL,
      updated_at  timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE app.utpata_events (
      id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      event_date     date        NOT NULL,
      end_date       date        CHECK (end_date IS NULL OR end_date >= event_date),
      kind           text        NOT NULL,
      description_en text,
      description_te text,
      region         text,
      source         text        NOT NULL,
      created_by     uuid        REFERENCES app.users (id) ON DELETE SET NULL,
      created_at     timestamptz NOT NULL DEFAULT now(),
      deleted_at     timestamptz
    )
    """,
    "CREATE INDEX utpata_date_idx ON app.utpata_events (event_date) WHERE deleted_at IS NULL",
    """
    CREATE TABLE app.announcements (
      id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      title_en   text,
      title_te   text,
      body_en    text,
      body_te    text,
      audience   text        NOT NULL DEFAULT 'all' CHECK (audience IN ('all','users','admins')),
      starts_at  timestamptz NOT NULL,
      ends_at    timestamptz,
      created_by uuid        REFERENCES app.users (id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT announce_title CHECK (title_en IS NOT NULL OR title_te IS NOT NULL)
    )
    """,
    "CREATE INDEX announce_window_idx ON app.announcements (starts_at, ends_at)",
]

DOWNGRADE = [
    "DROP TABLE IF EXISTS app.announcements",
    "DROP TABLE IF EXISTS app.utpata_events",
    "DROP TABLE IF EXISTS app.app_settings",
    "DROP TABLE IF EXISTS app.audit_logs",
    "DROP TABLE IF EXISTS app.family_events",
    "DROP TABLE IF EXISTS app.saved_searches",
    "DROP TABLE IF EXISTS app.family_profiles",
    "DROP TABLE IF EXISTS app.rate_limits",
    "DROP TABLE IF EXISTS app.sessions",
    "DROP TABLE IF EXISTS app.otp_requests",
    "DROP TABLE IF EXISTS app.users",
    "DROP FUNCTION IF EXISTS app.touch_updated_at()",
]


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)
