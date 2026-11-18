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
    "users.create", "users.edit", "users.delete",
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
    (Super Admin Control Plan D10, 13 Nov 2026); with the defaults they equal _ADMIN. The super admin's and
    users' are fixed."""
    if role != "admin":
        return ROLE_PERMISSIONS.get(role, frozenset())
    from app.auth.app_settings import get_setting          # lazy: settings import the database layer
    from app.auth.config_registry import ADMIN_POWERS, AdminPowers
    powers = {**AdminPowers().model_dump(), **(get_setting("admin_powers") or {})}
    perms = set(_USER) | {"admin.dashboard"}
    perms |= {perm for power, perm in ADMIN_POWERS.items() if powers.get(power)}
    return frozenset(perms)


def has_permission(user: dict, permission: str) -> bool:
    return permission in permissions_for((user or {}).get("role", ""))


def require(permission: str) -> Callable:
    """FastAPI dependency: the signed-in user, if their role has `permission`; 403 otherwise."""
    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        if not has_permission(current_user, permission):
            raise HTTPException(status_code=403, detail="You do not have permission to do this.")
        return current_user
    return _check
