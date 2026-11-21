"""
Who may do what (web portal plan, "Who sees what"). One map, checked on the server.

    Depends(require("users.view"))      in a route
    has_permission(user, "users.role")  in code
"""
from typing import Callable, Dict, FrozenSet

from fastapi import Depends, HTTPException

from .dependencies import get_current_user

_USER = frozenset({
    "muhurta.search", "panchang.view", "self.edit", "self.mobile", "self.sessions",
})
_ADMIN = _USER | {
    "admin.dashboard", "users.view", "users.view_mobile", "users.disable", "content.edit", "audit.view_users",
}
_SUPER = _ADMIN | {
    "users.role", "users.disable_admins", "settings.edit", "system.view", "audit.view_all",
    "users.create", "users.edit", "users.delete", "users.set_password",
}

ROLE_PERMISSIONS: Dict[str, FrozenSet[str]] = {"user": _USER, "admin": frozenset(_ADMIN), "super_admin": frozenset(_SUPER)}

# Each role's landing page after sign-in. Users land on the live Panchang page (user's choice, 13 Nov 2026).
ROLE_HOME = {"user": "/panchang-lookup.html", "admin": "/admin.html", "super_admin": "/admin.html"}

# Pages only some roles may open (anything else that is signed in is open to every role).
PAGE_PERMISSIONS = {
    "/admin.html": "admin.dashboard",
    "/admin-users.html": "users.view",
    "/admin-content.html": "content.edit",
    "/admin-settings.html": "settings.edit",
    "/admin-muhurtas.html": "settings.edit",
    "/admin-stats.html": "system.view",
}


def permissions_for(role: str) -> FrozenSet[str]:
    """A role's permissions. The admin's come from the super admin's "What admins may do" settings
    (Super Admin Control Plan D10, 13 Nov 2026); with the defaults they equal _ADMIN.
    The user's come from "user_powers" in app_settings (RBAC Plan).
    The super admin's are fixed."""
    if role == "super_admin":
        return ROLE_PERMISSIONS["super_admin"]
    if role == "admin":
        from app.auth.app_settings import get_setting          # lazy: settings import the database layer
        from app.auth.config_registry import ADMIN_POWERS, AdminPowers
        powers = {**AdminPowers().model_dump(), **(get_setting("admin_powers") or {})}
        perms = set(_USER) | {"admin.dashboard"}
        perms |= {perm for power, perm in ADMIN_POWERS.items() if powers.get(power)}
        return frozenset(perms)
    if role == "user":
        from app.auth.app_settings import get_setting
        from app.auth.config_registry import USER_POWERS, UserPowers
        powers = {**UserPowers().model_dump(), **(get_setting("user_powers") or {})}
        perms = {"self.mobile"}
        perms |= {perm for power, perm in USER_POWERS.items() if powers.get(power)}
        return frozenset(perms)
    return frozenset()


def _load_user_overrides(user_id: str) -> Dict[str, bool]:
    """Return dict of {permission_key: is_enabled} for user from DB."""
    if not user_id:
        return {}
    try:
        from sqlalchemy import text
        from app.db.engine import app_engine
        with app_engine().connect() as c:
            rows = c.execute(
                text("SELECT permission_key, is_enabled FROM app.user_permissions WHERE user_id = CAST(:u AS uuid)"),
                {"u": user_id}
            ).fetchall()
        return {r[0]: bool(r[1]) for r in rows}
    except Exception:
        return {}


PARENT_PERMS: Dict[str, str] = {
    # Panchang child -> parent
    "panchang.change_place": "panchang.view",
    "panchang.change_date": "panchang.view",
    "panchang.share": "panchang.view",
    "panchang.export_pdf": "panchang.view",
    "panchang.month": "panchang.view",
    "panchang.find_muhurtha": "panchang.view",
    "panchang.live_cards": "panchang.view",
    "panchang.angas": "panchang.view",
    "panchang.timeline": "panchang.view",
    "panchang.timings": "panchang.view",
    "panchang.ashta_kaalas": "panchang.view",
    "panchang.hora_choghadiya": "panchang.view",
    "panchang.chandrabalam": "panchang.view",
    "panchang.lagnas": "panchang.view",
    "panchang.shloka": "panchang.view",

    # Monthly child -> parent
    "panchang_month.navigate": "panchang_month.view",
    "panchang_month.day_details": "panchang_month.view",
    "panchang_month.export_pdf": "panchang_month.view",
    "panchang_month.festivals": "panchang_month.view",

    # Muhurtha child -> parent
    "muhurta.select_activity": "muhurta.search",
    "muhurta.date_range": "muhurta.search",
    "muhurta.time_filters": "muhurta.search",
    "muhurta.participants": "muhurta.search",
    "muhurta.audit": "muhurta.search",
    "muhurta.save": "muhurta.search",
    "muhurta.delete": "muhurta.search",
    "muhurta.export": "muhurta.search",

    # Family child -> parent
    "family.add": "family.view",
    "family.view_details": "family.view",
    "family.edit": "family.view",
    "family.delete": "family.view",
    "family.events": "family.view",
    "family.export": "family.view",

    # Saved child -> parent
    "saved.favourite": "saved.view",
    "saved.edit_label": "saved.view",
    "saved.delete": "saved.view",
    "saved.export": "saved.view",

    # Account child -> parent
    "self.edit_name": "self.edit",
    "self.edit_language": "self.edit",
    "self.edit_home_place": "self.edit",
    "self.sessions": "self.edit",
    "self.delete_account": "self.edit",

    # Admin Users child -> parent
    "users.view_mobile": "users.view",
    "users.disable": "users.view",
    "users.create": "users.view",
    "users.edit": "users.view",
    "users.delete": "users.view",
    "users.reset_sessions": "users.view",
    "users.export": "users.view",
    "users.set_perms": "users.view",
    "users.set_password": "users.view",
}


def _raw_resolve_permission(user: dict, permission: str) -> bool:
    if not user:
        return False
    role = user.get("role", "")
    if role == "super_admin":
        return True

    # Layer 1: per-user override
    overrides = user.get("_perm_overrides")
    if overrides is None and user.get("id"):
        overrides = _load_user_overrides(user["id"])
        user["_perm_overrides"] = overrides

    if overrides and permission in overrides:
        return bool(overrides[permission])

    # Layer 2: role permissions
    return permission in permissions_for(role)


def resolve_permission(user: dict, permission: str) -> bool:
    """3-layer resolution with hierarchical parent dependency check:
    If parent permission is disabled, child permission is disabled too.
    """
    if not user:
        return False
    if user.get("role") == "super_admin":
        return True

    # Check parent dependency first
    parent = PARENT_PERMS.get(permission)
    if parent and not _raw_resolve_permission(user, parent):
        return False

    return _raw_resolve_permission(user, permission)


def has_permission(user: dict, permission: str) -> bool:
    return resolve_permission(user, permission)


def require(permission: str) -> Callable:
    """FastAPI dependency: the signed-in user, if their role has `permission`; 403 otherwise."""
    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        if not has_permission(current_user, permission):
            raise HTTPException(status_code=403, detail="You do not have permission to do this.")
        return current_user
    return _check
