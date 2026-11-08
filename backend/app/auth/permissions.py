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
}

ROLE_PERMISSIONS: Dict[str, FrozenSet[str]] = {"user": _USER, "admin": frozenset(_ADMIN), "super_admin": frozenset(_SUPER)}

# Each role's landing page after sign-in.
ROLE_HOME = {"user": "/home.html", "admin": "/admin.html", "super_admin": "/admin.html"}

# Pages only some roles may open (anything else that is signed in is open to every role).
PAGE_PERMISSIONS = {
    "/admin.html": "admin.dashboard",
    "/admin-users.html": "users.view",
    "/admin-content.html": "content.edit",
    "/admin-settings.html": "settings.edit",
}


def has_permission(user: dict, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get((user or {}).get("role", ""), frozenset())


def require(permission: str) -> Callable:
    """FastAPI dependency: the signed-in user, if their role has `permission`; 403 otherwise."""
    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        if not has_permission(current_user, permission):
            raise HTTPException(status_code=403, detail="You do not have permission to do this.")
        return current_user
    return _check
