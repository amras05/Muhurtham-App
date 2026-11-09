"""
Account storage on PostgreSQL (schema `app`; see alembic/versions/0001_initial_accounts.py).

Replaces the old SQLite module. The function names are unchanged so the routes keep working.
Rows come back as dicts that also carry the fields the API has always returned:
  phone        10 digits for Indian numbers (users.mobile holds E.164: +919848012345)
  is_verified  mobile_verified_at is set
  is_active    status = 'active'

Accounts that started sign-up but have not confirmed the OTP are stored with
status 'disabled' and disabled_reason 'pending_verification' (the table only allows an
active account once its mobile is verified).
"""
import hashlib
import hmac
import json
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import text

from app.auth.mobile import display_phone
from app.core.config import SECRET_KEY
from app.db.engine import app_engine

PENDING = "pending_verification"
INVITED = "invited"            # added by the super admin; activates when the person confirms a code
MAX_OTP_ATTEMPTS = 5

_USER_COLUMNS = """
    id::text AS id, mobile, mobile_verified_at, name, email, password_hash, role, status,
    disabled_reason, preferred_language, created_at, updated_at, last_login_at, login_count,
    failed_logins, locked_until, home_place, home_lat, home_lon, home_tz
"""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: Any) -> Optional[str]:
    return value.isoformat() if isinstance(value, datetime) else value


def _user_dict(row) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    u = dict(row._mapping)
    u["phone"] = display_phone(u.get("mobile"))
    u["is_verified"] = u.get("mobile_verified_at") is not None
    u["is_active"] = u.get("status") == "active"
    for k in ("mobile_verified_at", "created_at", "updated_at", "last_login_at", "locked_until"):
        u[k] = _iso(u.get(k))
    for k in ("home_lat", "home_lon", "home_tz"):          # numeric columns arrive as Decimal
        u[k] = float(u[k]) if u.get(k) is not None else None
    return u


def _default_name(mobile: str) -> str:
    """Placeholder until the user sets a name (sign-up does not ask for one yet)."""
    return f"User {mobile[-4:]}"


# ── Users ─────────────────────────────────────────────────────────────────────

def get_user_by_phone(mobile: str) -> Optional[Dict[str, Any]]:
    """`mobile` must already be E.164 (see app.auth.mobile.normalize_mobile)."""
    with app_engine().connect() as c:
        row = c.execute(text(f"SELECT {_USER_COLUMNS} FROM app.users WHERE mobile = :m"), {"m": mobile}).first()
    return _user_dict(row)


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    try:
        uuid.UUID(str(user_id))
    except ValueError:  # e.g. an id from an old SQLite-era token: "no such user", not a crash
        return None
    with app_engine().connect() as c:
        row = c.execute(text(f"SELECT {_USER_COLUMNS} FROM app.users WHERE id = CAST(:i AS uuid)"),
                        {"i": user_id}).first()
    return _user_dict(row)


def create_user(phone: str, password_hash: str, name: str = None, role: str = "user",
                is_verified: bool = False) -> Dict[str, Any]:
    """Create an account. Unverified accounts wait in status 'disabled' / pending_verification."""
    params = {
        "m": phone, "n": (name or _default_name(phone)), "p": password_hash, "r": role,
        "v": _now() if is_verified else None,
        "s": "active" if is_verified else "disabled",
        "d": None if is_verified else PENDING,
    }
    with app_engine().begin() as c:
        row = c.execute(text(f"""
            INSERT INTO app.users (mobile, name, password_hash, role, mobile_verified_at, status, disabled_reason)
            VALUES (:m, :n, :p, :r, :v, :s, :d)
            RETURNING {_USER_COLUMNS}"""), params).first()
    return _user_dict(row)


# Fields the routes may change, mapped to safe SQL (no column name comes from input).
def update_user_profile(user_id: str, fields: Dict[str, Any]) -> None:
    sets, params = [], {"i": user_id}
    for key, val in fields.items():
        if key == "name":
            sets.append("name = :name"); params["name"] = val
        elif key == "password_hash":
            sets.append("password_hash = :pw"); params["pw"] = val
        elif key == "consent_version":
            sets.append("consent_version = :cv, consent_at = now()"); params["cv"] = val
        elif key == "mobile":
            # Caller has verified the new number by OTP; it stays verified.
            sets.append("mobile = :mob, mobile_verified_at = now()"); params["mob"] = val
        elif key == "preferred_language":
            sets.append("preferred_language = :lang"); params["lang"] = val
        elif key == "home":
            sets.append("home_place = :hp, home_lat = :hla, home_lon = :hlo, home_tz = :htz")
            params.update(hp=val[0], hla=val[1], hlo=val[2], htz=val[3])
        elif key == "unlock" and val:
            sets.append("failed_logins = 0, locked_until = NULL")
        elif key == "is_verified" and val:
            sets.append("mobile_verified_at = COALESCE(mobile_verified_at, now())")
            # Finishing sign-up (or accepting an invitation) activates the account; an account an
            # admin disabled stays disabled.
            sets.append("status = CASE WHEN disabled_reason IN (:pending, :invited) THEN 'active' ELSE status END")
            sets.append("disabled_reason = CASE WHEN disabled_reason IN (:pending, :invited) THEN NULL ELSE disabled_reason END")
            params["pending"] = PENDING
            params["invited"] = INVITED
        else:
            raise ValueError(f"update_user_profile: field '{key}' cannot be changed here")
    if not sets:
        return
    with app_engine().begin() as c:
        c.execute(text(f"UPDATE app.users SET {', '.join(sets)} WHERE id = CAST(:i AS uuid)"), params)


def log_login_event(user_id: str) -> None:
    with app_engine().begin() as c:
        c.execute(text("""UPDATE app.users SET last_login_at = now(), login_count = login_count + 1,
                          failed_logins = 0, locked_until = NULL
                          WHERE id = CAST(:i AS uuid)"""), {"i": user_id})


# ── OTP (hashed; one row per code sent) ───────────────────────────────────────

def _code_hash(mobile: str, code: str) -> str:
    return hmac.new(SECRET_KEY.encode(), f"{mobile}:{code}".encode(), hashlib.sha256).hexdigest()


def store_otp(phone: str, code: str, expires_at: datetime, purpose: str = "signup",
              channel: str = "whatsapp", ip_address: Optional[str] = None) -> None:
    """Older unused codes for the same number and purpose stop working when a new one is sent."""
    exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
    with app_engine().begin() as c:
        c.execute(text("""UPDATE app.otp_requests SET consumed_at = now()
                          WHERE mobile = :m AND purpose = :p AND consumed_at IS NULL"""),
                  {"m": phone, "p": purpose})
        c.execute(text("""INSERT INTO app.otp_requests (mobile, purpose, code_hash, channel, expires_at, ip_address)
                          VALUES (:m, :p, :h, :ch, :e, CAST(:ip AS inet))"""),
                  {"m": phone, "p": purpose, "h": _code_hash(phone, code), "ch": channel, "e": exp,
                   "ip": ip_address})


def check_otp(phone: str, code: str, purpose: str = "signup") -> str:
    """
    Verify a code: 'ok' (and it is used up), 'none', 'expired', 'locked' (too many wrong
    tries) or 'wrong'. Runs in one transaction so two requests can't both use one code.
    """
    with app_engine().begin() as c:
        row = c.execute(text("""SELECT id, code_hash, attempts, expires_at FROM app.otp_requests
                                WHERE mobile = :m AND purpose = :p AND consumed_at IS NULL
                                ORDER BY created_at DESC LIMIT 1 FOR UPDATE"""),
                        {"m": phone, "p": purpose}).first()
        if row is None:
            return "none"
        if row.expires_at <= _now():
            c.execute(text("UPDATE app.otp_requests SET consumed_at = now() WHERE id = :i"), {"i": row.id})
            return "expired"
        if row.attempts >= MAX_OTP_ATTEMPTS:
            return "locked"
        if not hmac.compare_digest(row.code_hash, _code_hash(phone, (code or "").strip())):
            c.execute(text("UPDATE app.otp_requests SET attempts = attempts + 1 WHERE id = :i"), {"i": row.id})
            return "locked" if row.attempts + 1 >= MAX_OTP_ATTEMPTS else "wrong"
        c.execute(text("UPDATE app.otp_requests SET consumed_at = now() WHERE id = :i"), {"i": row.id})
        return "ok"


def get_otp(phone: str) -> Optional[Dict[str, Any]]:
    """Latest unused code record (without the code). Kept for callers that only need to know one exists."""
    with app_engine().connect() as c:
        row = c.execute(text("""SELECT id::text AS id, purpose, expires_at, attempts FROM app.otp_requests
                                WHERE mobile = :m AND consumed_at IS NULL
                                ORDER BY created_at DESC LIMIT 1"""), {"m": phone}).first()
    return dict(row._mapping) if row else None


def delete_otp(phone: str) -> None:
    """Mark every unused code for this number as used."""
    with app_engine().begin() as c:
        c.execute(text("UPDATE app.otp_requests SET consumed_at = now() WHERE mobile = :m AND consumed_at IS NULL"),
                  {"m": phone})


# ── Audit log ─────────────────────────────────────────────────────────────────

def write_activity_log(user_id: Optional[str], action: str, details: str = None, ip_address: str = None,
                       target_type: str = None, target_id: str = None) -> None:
    """Append to app.audit_logs. Never pass OTPs, passwords, tokens, birth data or full mobiles."""
    with app_engine().begin() as c:
        c.execute(text("""
            INSERT INTO app.audit_logs (actor_id, actor_role, action, target_type, target_id, details_json, ip_address)
            VALUES (CAST(:a AS uuid), (SELECT role FROM app.users WHERE id = CAST(:a AS uuid)),
                    :act, :tt, :ti, CAST(:d AS jsonb), CAST(:ip AS inet))"""),
                  {"a": user_id, "act": action, "tt": target_type, "ti": target_id,
                   "d": json.dumps({"text": details}) if details else None, "ip": ip_address})


# ── Admin reads ───────────────────────────────────────────────────────────────

def fetch_all_users(search: str = None, role: str = None) -> List[Dict[str, Any]]:
    where, params = ["status <> 'deleted'"], {}
    if search:
        where.append("(mobile LIKE :s OR name ILIKE :s)")
        params["s"] = f"%{search.strip()}%"
    if role:
        where.append("role = :r")
        params["r"] = role
    with app_engine().connect() as c:
        rows = c.execute(text(f"SELECT {_USER_COLUMNS} FROM app.users WHERE {' AND '.join(where)} "
                              "ORDER BY created_at DESC LIMIT 500"), params).all()
    return [_user_dict(r) for r in rows]


def fetch_activity_logs(user_id: str = None, limit: int = 50) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {"lim": max(1, min(int(limit), 500))}
    where = ""
    if user_id:
        where = "WHERE l.actor_id = CAST(:u AS uuid)"
        params["u"] = user_id
    with app_engine().connect() as c:
        rows = c.execute(text(f"""
            SELECT l.id::text AS id, COALESCE(l.actor_id::text, '') AS user_id, u.name AS user_name,
                   l.action, l.details_json ->> 'text' AS details, host(l.ip_address) AS ip_address,
                   l.created_at AS timestamp
            FROM app.audit_logs l LEFT JOIN app.users u ON u.id = l.actor_id
            {where} ORDER BY l.created_at DESC LIMIT :lim"""), params).all()
    out = []
    for r in rows:
        d = dict(r._mapping)
        d["timestamp"] = _iso(d["timestamp"])
        out.append(d)
    return out


def fetch_system_statistics() -> Dict[str, int]:
    with app_engine().connect() as c:
        r = c.execute(text("""
            SELECT count(*) FILTER (WHERE status <> 'deleted')                        AS total_users,
                   count(*) FILTER (WHERE status = 'active')                          AS active_users,
                   count(*) FILTER (WHERE mobile_verified_at IS NOT NULL)             AS verified_users,
                   count(*) FILTER (WHERE role = 'admin' AND status <> 'deleted')     AS admin_users,
                   count(*) FILTER (WHERE role = 'super_admin' AND status <> 'deleted') AS super_admin_users,
                   (SELECT count(*) FROM app.audit_logs)                               AS total_logs
            FROM app.users""")).one()
    return {k: int(v) for k, v in r._mapping.items()}


def count_active_super_admins() -> int:
    with app_engine().connect() as c:
        return int(c.execute(text("SELECT count(*) FROM app.users WHERE role = 'super_admin' AND status = 'active'"))
                   .scalar())


def new_numeric_code(digits: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(digits))
