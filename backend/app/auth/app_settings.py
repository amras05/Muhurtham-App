"""
App settings the super admin changes without a redeploy (table app.app_settings).

  signup_open           anyone may create an account (D4: open by default)
  maintenance_mode      only the super admin can use the site; everyone else sees a notice
  maintenance_message   the notice text

Read through a 15-second cache: page loads don't hit the database each time, and a change
reaches every worker within 15 seconds. Secrets never go here (they stay in the environment).
"""
import json
import time
from typing import Any, Dict, Optional

from sqlalchemy import text

from app.core.logging import logger
from app.db.engine import app_engine

DEFAULTS: Dict[str, Any] = {
    "signup_open": True,
    "maintenance_mode": False,
    "maintenance_message": "Muhurtham is being updated. Please try again in a little while.",
    "catalog_visibility": {"hidden_tabs": [], "hidden_events": [], "hidden_tools": []},   # plan R12
    # Notifications (plan R11)
    "otp_sending": True,          # False pauses every login code (sign-up, forgot password, new mobile)
    "otp_language": "en",         # language of the WhatsApp code template; Meta must have approved it
    "admin_alerts": {"signup": True, "locked": True, "disabled": True, "daily_summary": True},
}
_TTL = 15.0
_cache: Dict[str, Any] = {}
_loaded_at = 0.0


def all_settings(fresh: bool = False) -> Dict[str, Any]:
    global _cache, _loaded_at
    if not fresh and _cache and time.monotonic() - _loaded_at < _TTL:
        return dict(_cache)
    values = dict(DEFAULTS)
    try:
        with app_engine().connect() as c:
            for key, val in c.execute(text("SELECT setting_key, value_json FROM app.app_settings")):
                if key in DEFAULTS:
                    values[key] = val
    except Exception as ex:   # database down: keep serving with the last known (or default) values
        logger.warning(f"Settings unavailable, using last known values: {type(ex).__name__}")
        return dict(_cache or DEFAULTS)
    _cache, _loaded_at = values, time.monotonic()
    return dict(values)


def get_setting(key: str) -> Any:
    return all_settings().get(key, DEFAULTS.get(key))


def save_settings(changes: Dict[str, Any], user_id: Optional[str]) -> Dict[str, Any]:
    with app_engine().begin() as c:
        for key, val in changes.items():
            c.execute(text("""
                INSERT INTO app.app_settings (setting_key, value_json, updated_by, updated_at)
                VALUES (:k, CAST(:v AS jsonb), CAST(:u AS uuid), now())
                ON CONFLICT (setting_key) DO UPDATE SET value_json = EXCLUDED.value_json,
                    updated_by = EXCLUDED.updated_by, updated_at = now()"""),
                {"k": key, "v": json.dumps(val), "u": user_id})
    return all_settings(fresh=True)
