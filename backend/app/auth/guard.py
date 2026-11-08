"""
Sign-in on every page (web portal plan, C1; decision D1).

Runs before the static files. For "/" and any .html page except login.html:
  no valid session      → /auth/web/resume?next=<page>   (renews from the refresh cookie,
                          or sends the person to log in)
  "/"                   → the role's home page
  page needs a role     → a plain "not for your role" page (403)
Everything else (CSS, JS, the API) passes through; the API has its own checks.
"""
from urllib.parse import quote

from fastapi.responses import HTMLResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.config import get_settings

from .crypto import decode_access_token
from .database import get_user_by_id
from .dependencies import ACCESS_COOKIE
from .app_settings import get_setting
from .permissions import PAGE_PERMISSIONS, ROLE_HOME, has_permission
from .sessions import session_is_active

PUBLIC_PAGES = {"/login.html", "/files/login.html"}
FALLBACK_HOME = "/muhurta-finder.html"   # until a role's home page exists

FORBIDDEN_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Not available · Muhurtham</title>
<link rel="stylesheet" href="/css/common.css"></head>
<body><main style="max-width:32rem;margin:15vh auto;padding:0 16px;display:grid;gap:12px">
<h1 style="margin:0">This page is for administrators</h1>
<p style="margin:0">Your account can't open it. <span lang="te">ఈ పేజీ నిర్వాహకులకు మాత్రమే.</span></p>
<p style="margin:0"><a href="/">Go to your home page</a></p></main></body></html>"""


MAINTENANCE_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Being updated · Muhurtham</title>
<link rel="stylesheet" href="/css/common.css"></head>
<body><main style="max-width:32rem;margin:15vh auto;padding:0 16px;display:grid;gap:12px">
<h1 style="margin:0">Back soon</h1><p style="margin:0">{message}</p>
<p style="margin:0" lang="te">ముహూర్తం నవీకరించబడుతోంది. కొద్దిసేపటి తర్వాత ప్రయత్నించండి.</p></main></body></html>"""


def session_user(request: Request):
    """The signed-in user from the web access cookie, or None (never raises)."""
    token = request.cookies.get(ACCESS_COOKIE)
    payload = decode_access_token(token) if token else None
    if not payload or not payload.get("sub"):
        return None
    try:
        user = get_user_by_id(payload["sub"])
        if not user or not user.get("is_active") or not session_is_active(payload.get("sid"), payload["sub"]):
            return None
    except Exception:   # database unreachable: treat as signed out; the API reports the real error
        return None
    return user


def _home_for(user: dict) -> str:
    home = ROLE_HOME.get(user.get("role"), FALLBACK_HOME)
    if not (get_settings().WEBAPP_DIR / home.lstrip("/")).is_file():
        return FALLBACK_HOME
    return home


class PageGuard(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        is_page = path == "/" or path.endswith(".html")
        if not is_page or path in PUBLIC_PAGES or request.method not in ("GET", "HEAD"):
            return await call_next(request)

        user = session_user(request)
        if user is None:
            next_page = path.rsplit("/", 1)[-1] if path != "/" else ""
            return RedirectResponse(f"/auth/web/resume?next={quote(next_page)}", status_code=303)
        if get_setting("maintenance_mode") and user.get("role") != "super_admin":
            msg = str(get_setting("maintenance_message") or "")
            safe = msg.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            return HTMLResponse(MAINTENANCE_PAGE.replace("{message}", safe), status_code=503)
        if path in ("/", "/index.html"):
            return RedirectResponse(_home_for(user), status_code=303)
        needed = PAGE_PERMISSIONS.get(path)
        if needed and not has_permission(user, needed):
            return HTMLResponse(FORBIDDEN_PAGE, status_code=403)
        return await call_next(request)
