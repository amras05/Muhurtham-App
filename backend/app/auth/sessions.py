"""
Signed-in devices (app.sessions) and the database-backed limits (app.rate_limits, app.otp_requests).

A login creates a session and returns two tokens:
  access token   30 minutes, carries the session id (sid); checked on every request
  refresh token  30 days, random, stored only as a SHA-256 hash; each use replaces it
Logging out, resetting the password or changing the mobile revokes sessions at once.

Limits are counted in PostgreSQL because the server runs more than one worker.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text

from app.db.engine import app_engine

SESSION_DAYS = 30

# OTP sending (Input / accounts plan, "OTP rules")
OTP_PER_MOBILE_15MIN = 3
OTP_PER_MOBILE_DAY = 10
OTP_PER_IP_HOUR = 20
OTP_RESEND_WAIT_SECONDS = 30

# Password login
LOGIN_FAILS_BEFORE_LOCK = 5
LOGIN_LOCK_MINUTES = 15
LOGIN_PER_IP_15MIN = 30


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _is_uuid(value: Any) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False


def _device_label(user_agent: Optional[str]) -> str:
    ua = (user_agent or "").lower()
    if "dart" in ua or "dio" in ua:
        return "Mobile app"
    for key, label in (("android", "Android browser"), ("iphone", "iPhone browser"), ("ipad", "iPad browser"),
                       ("macintosh", "Mac browser"), ("windows", "Windows browser"), ("linux", "Linux browser")):
        if key in ua:
            return label
    return "Unknown device"


# ── Sessions ──────────────────────────────────────────────────────────────────

def create_session(user_id: str, user_agent: Optional[str], ip: Optional[str]) -> Tuple[str, str]:
    """New session for a user; returns (session_id, refresh_token)."""
    refresh = secrets.token_urlsafe(48)
    with app_engine().begin() as c:
        sid = c.execute(text("""
            INSERT INTO app.sessions (user_id, refresh_hash, device_label, user_agent, ip_address, last_used_at, expires_at)
            VALUES (CAST(:u AS uuid), :h, :d, :ua, CAST(:ip AS inet), now(), now() + make_interval(days => :days))
            RETURNING id::text"""),
            {"u": user_id, "h": _hash(refresh), "d": _device_label(user_agent), "ua": (user_agent or "")[:255],
             "ip": ip, "days": SESSION_DAYS}).scalar()
    return sid, refresh


def rotate_refresh(refresh_token: str) -> Optional[Tuple[str, str, str]]:
    """Use a refresh token once: returns (user_id, session_id, new_refresh_token) or None."""
    if not refresh_token:
        return None
    new_refresh = secrets.token_urlsafe(48)
    with app_engine().begin() as c:
        row = c.execute(text("""
            SELECT s.id::text AS sid, s.user_id::text AS uid, u.status
            FROM app.sessions s JOIN app.users u ON u.id = s.user_id
            WHERE s.refresh_hash = :h AND s.revoked_at IS NULL AND s.expires_at > now()
            FOR UPDATE OF s"""), {"h": _hash(refresh_token)}).first()
        if row is None:
            # Plan R5: a token this session already swapped away is being used again, so it was
            # copied. Sign that person out everywhere (the real owner just logs in again).
            reused = c.execute(text("""SELECT id::text AS sid, user_id::text AS uid,
                                              (last_used_at > now() - interval '60 seconds') AS just_swapped
                                       FROM app.sessions WHERE previous_refresh_hash = :h AND revoked_at IS NULL"""),
                               {"h": _hash(refresh_token)}).first()
            # Two tabs renewing at the same moment send the same token a second apart: within
            # 60 seconds of the swap that is refused quietly, not treated as a stolen token.
            if reused and not reused.just_swapped:
                n = c.execute(text("UPDATE app.sessions SET revoked_at = now() WHERE user_id = CAST(:u AS uuid) "
                                   "AND revoked_at IS NULL"), {"u": reused.uid}).rowcount
                c.execute(text("""INSERT INTO app.audit_logs (actor_id, actor_role, action, target_type, target_id, details_json)
                                  VALUES (CAST(:u AS uuid), (SELECT role FROM app.users WHERE id = CAST(:u AS uuid)),
                                          'session.reuse', 'session', CAST(:s AS text), jsonb_build_object('text', CAST(:d AS text)))"""),
                          {"u": reused.uid, "s": reused.sid,
                           "d": f"An old sign-in token was used again; {n} device(s) signed out to be safe"})
            return None
        if row.status != "active":
            return None
        c.execute(text("""UPDATE app.sessions SET previous_refresh_hash = refresh_hash, refresh_hash = :nh,
                          last_used_at = now(), expires_at = now() + make_interval(days => :days)
                          WHERE id = CAST(:s AS uuid)"""),
                  {"nh": _hash(new_refresh), "s": row.sid, "days": SESSION_DAYS})
    return row.uid, row.sid, new_refresh


def refresh_just_swapped(refresh_token: str) -> bool:
    """After rotate_refresh refused a token: True when another tab swapped it in the last 60 seconds.
    The browser already holds that tab's new cookies, so they must not be cleared (plan F2)."""
    if not refresh_token:
        return False
    with app_engine().connect() as c:
        return c.execute(text("""SELECT 1 FROM app.sessions WHERE previous_refresh_hash = :h AND revoked_at IS NULL
                                 AND last_used_at > now() - interval '60 seconds'"""),
                         {"h": _hash(refresh_token)}).first() is not None


def session_is_active(session_id: Any, user_id: str) -> bool:
    if not _is_uuid(session_id):
        return False
    with app_engine().connect() as c:
        return c.execute(text("""SELECT 1 FROM app.sessions WHERE id = CAST(:s AS uuid) AND user_id = CAST(:u AS uuid)
                                 AND revoked_at IS NULL AND expires_at > now()"""),
                         {"s": session_id, "u": user_id}).first() is not None


def revoke_session(session_id: str, user_id: str) -> bool:
    if not _is_uuid(session_id):
        return False
    with app_engine().begin() as c:
        return c.execute(text("""UPDATE app.sessions SET revoked_at = now() WHERE id = CAST(:s AS uuid)
                                 AND user_id = CAST(:u AS uuid) AND revoked_at IS NULL"""),
                         {"s": session_id, "u": user_id}).rowcount > 0


def revoke_all_sessions(user_id: str, except_session: Optional[str] = None) -> int:
    with app_engine().begin() as c:
        return c.execute(text("""UPDATE app.sessions SET revoked_at = now()
                                 WHERE user_id = CAST(:u AS uuid) AND revoked_at IS NULL
                                 AND (CAST(:x AS uuid) IS NULL OR id <> CAST(:x AS uuid))"""),
                         {"u": user_id, "x": except_session if _is_uuid(except_session) else None}).rowcount


def list_sessions(user_id: str) -> List[Dict[str, Any]]:
    with app_engine().connect() as c:
        rows = c.execute(text("""SELECT id::text AS id, device_label, host(ip_address) AS ip_address,
                                        created_at, last_used_at, expires_at
                                 FROM app.sessions WHERE user_id = CAST(:u AS uuid) AND revoked_at IS NULL
                                 AND expires_at > now() ORDER BY last_used_at DESC NULLS LAST"""),
                         {"u": user_id}).all()
    return [{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in r._mapping.items()} for r in rows]


# ── Limits ────────────────────────────────────────────────────────────────────

def otp_send_block(mobile: str, ip: Optional[str]) -> Optional[Tuple[str, int]]:
    """Why a new code may not be sent now, and seconds to wait; None if it may."""
    with app_engine().connect() as c:
        r = c.execute(text("""
            SELECT count(*) FILTER (WHERE mobile = :m AND created_at > now() - interval '15 minutes') AS m15,
                   count(*) FILTER (WHERE mobile = :m AND created_at > now() - interval '1 day')      AS mday,
                   count(*) FILTER (WHERE CAST(:ip AS text) IS NOT NULL AND ip_address = CAST(:ip AS inet)
                                    AND created_at > now() - interval '1 hour')                      AS iph,
                   max(created_at) FILTER (WHERE mobile = :m)                                         AS last_at
            FROM app.otp_requests
            WHERE (mobile = :m AND created_at > now() - interval '1 day')
               OR (CAST(:ip AS text) IS NOT NULL AND ip_address = CAST(:ip AS inet) AND created_at > now() - interval '1 hour')"""),
            {"m": mobile, "ip": ip}).one()
    if r.last_at is not None:
        waited = (datetime.now(timezone.utc) - r.last_at).total_seconds()
        if waited < OTP_RESEND_WAIT_SECONDS:
            wait = int(OTP_RESEND_WAIT_SECONDS - waited) + 1
            return f"Please wait {wait} seconds before asking for another code.", wait
    if r.mday >= OTP_PER_MOBILE_DAY:
        return "Too many codes sent to this number today. Please try again tomorrow.", 3600
    if r.m15 >= OTP_PER_MOBILE_15MIN:
        return "Too many codes sent to this number. Please try again in 15 minutes.", 900
    if r.iph >= OTP_PER_IP_HOUR:
        return "Too many code requests from this network. Please try again later.", 3600
    return None


def hit(bucket: str, window_minutes: int, limit: int) -> bool:
    """Count one attempt in a fixed time window; False once the limit is passed."""
    with app_engine().begin() as c:
        hits = c.execute(text("""
            INSERT INTO app.rate_limits (bucket, window_start, hits)
            VALUES (:b, to_timestamp(floor(extract(epoch FROM now()) / (:w * 60)) * (:w * 60)), 1)
            ON CONFLICT (bucket, window_start) DO UPDATE SET hits = app.rate_limits.hits + 1
            RETURNING hits"""), {"b": bucket[:120], "w": window_minutes}).scalar()
        # Old windows are not needed; clear them now and then.
        if hits == 1:
            c.execute(text("DELETE FROM app.rate_limits WHERE window_start < now() - interval '2 days'"))
    return hits <= limit


def login_locked_until(user: Dict[str, Any]) -> Optional[datetime]:
    lu = user.get("locked_until")
    if not lu:
        return None
    lu = datetime.fromisoformat(lu) if isinstance(lu, str) else lu
    return lu if lu > datetime.now(timezone.utc) else None


def record_failed_login(user_id: str) -> None:
    with app_engine().begin() as c:
        c.execute(text("""
            UPDATE app.users SET failed_logins = failed_logins + 1,
                   locked_until = CASE WHEN failed_logins + 1 >= :n
                                       THEN now() + make_interval(mins => :mins) ELSE locked_until END
            WHERE id = CAST(:u AS uuid)"""), {"u": user_id, "n": LOGIN_FAILS_BEFORE_LOCK, "mins": LOGIN_LOCK_MINUTES})
        c.execute(text("UPDATE app.users SET failed_logins = 0 WHERE id = CAST(:u AS uuid) AND locked_until > now()"),
                  {"u": user_id})


def lock_minutes() -> int:
    return LOGIN_LOCK_MINUTES

