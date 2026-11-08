"""
Web sign-in: the same accounts as the app, but tokens travel in HttpOnly cookies that page
scripts cannot read (decision D7). Responses carry only the user, never a token.

  mh_access   access token, 30 minutes, Path=/
  mh_refresh  refresh token, 30 days, Path=/auth/web (sent only to these endpoints)
Both SameSite=Lax; Secure in production. Every POST here needs `X-Muhurtham-Client: web`.

Sign-up, resending a code, and password reset use the ordinary JSON endpoints (no tokens
involved); only the steps that start a session are here.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
import re
from urllib.parse import quote

from app.core.config import APP_ENV

from .crypto import ACCESS_TOKEN_MINUTES, create_access_token
from .database import get_user_by_id, write_activity_log
from .dependencies import ACCESS_COOKIE, REFRESH_COOKIE, WEB_CLIENT_HEADER, get_current_user
from .routes import _user_response, login, verify_otp
from .schemas import LoginRequest, LoginResponse, LogoutRequest, MessageResponse, UserResponse, VerifyOtpRequest
from .sessions import SESSION_DAYS, revoke_all_sessions, revoke_session, rotate_refresh

router = APIRouter(prefix="/auth/web", tags=["Web sign-in"])

SECURE = APP_ENV == "production"
REFRESH_PATH = "/auth/web"


def _require_web_header(req: Request) -> None:
    if req.headers.get(WEB_CLIENT_HEADER) != "web":
        raise HTTPException(status_code=403, detail="This request was blocked. Please reload the page and try again.")


def _set_cookies(resp: Response, access: str, refresh: str) -> None:
    resp.set_cookie(ACCESS_COOKIE, access, max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
                    httponly=True, secure=SECURE, samesite="lax")
    resp.set_cookie(REFRESH_COOKIE, refresh, max_age=SESSION_DAYS * 86400, path=REFRESH_PATH,
                    httponly=True, secure=SECURE, samesite="lax")


def _clear_cookies(resp: Response) -> None:
    resp.delete_cookie(ACCESS_COOKIE, path="/", secure=SECURE, httponly=True, samesite="lax")
    resp.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH, secure=SECURE, httponly=True, samesite="lax")


def _web_reply(resp: Response, result: LoginResponse) -> dict:
    _set_cookies(resp, result.access_token, result.refresh_token)
    return {"user": result.user.model_dump(), "expires_in": result.expires_in}


@router.post("/login")
async def web_login(request: LoginRequest, req: Request, resp: Response):
    _require_web_header(req)
    return _web_reply(resp, await login(request, req))


@router.post("/verify-otp")
async def web_verify_otp(request: VerifyOtpRequest, req: Request, resp: Response):
    _require_web_header(req)
    return _web_reply(resp, await verify_otp(request, req))


@router.post("/refresh")
async def web_refresh(req: Request, resp: Response):
    _require_web_header(req)
    rotated = rotate_refresh(req.cookies.get(REFRESH_COOKIE, ""))
    if not rotated:
        expired = JSONResponse({"detail": "Session expired. Please log in again."}, status_code=401)
        _clear_cookies(expired)        # the cookie removal must ride on the 401 itself
        return expired
    user_id, sid, new_refresh = rotated
    user = get_user_by_id(user_id)
    _set_cookies(resp, create_access_token(data={"sub": user_id, "role": user["role"], "sid": sid}), new_refresh)
    return {"user": _user_response(user).model_dump(), "expires_in": ACCESS_TOKEN_MINUTES * 60}


@router.get("/me", response_model=UserResponse)
async def web_me(current_user: dict = Depends(get_current_user)):
    return _user_response(current_user)


@router.post("/logout", response_model=MessageResponse)
async def web_logout(request: LogoutRequest, req: Request, resp: Response,
                     current_user: dict = Depends(get_current_user)):
    _require_web_header(req)
    if request.everywhere:
        n = revoke_all_sessions(current_user["id"])
        write_activity_log(user_id=current_user["id"], action="logout_everywhere",
                           details=f"Signed out {n} device(s) from the web", ip_address=req.client.host if req.client else None)
        message = "Signed out on every device."
    else:
        revoke_session(current_user["_session_id"], current_user["id"])
        write_activity_log(user_id=current_user["id"], action="logout", details="Signed out (web)",
                           ip_address=req.client.host if req.client else None)
        message = "Signed out."
    _clear_cookies(resp)
    return MessageResponse(message=message)


_SAFE_NEXT = re.compile(r"^[a-z0-9-]+\.html$", re.I)


@router.get("/resume", include_in_schema=False)
async def web_resume(req: Request, next: str = ""):
    """
    A page found no valid access cookie. The refresh cookie is only sent to /auth/web, so the
    page guard sends the browser here: renew the session and go back, or go to log in.
    Only a bare page name (e.g. "muhurta-finder.html", or "" for home) is accepted as `next`.
    """
    target = "/" + next if next and _SAFE_NEXT.match(next) else "/"
    rotated = rotate_refresh(req.cookies.get(REFRESH_COOKIE, ""))
    if not rotated:
        resp = RedirectResponse("/login.html" + (f"?next={quote(next)}" if target != "/" else ""), status_code=303)
        _clear_cookies(resp)
        return resp
    user_id, sid, new_refresh = rotated
    user = get_user_by_id(user_id)
    resp = RedirectResponse(target, status_code=303)
    _set_cookies(resp, create_access_token(data={"sub": user_id, "role": user["role"], "sid": sid}), new_refresh)
    return resp
