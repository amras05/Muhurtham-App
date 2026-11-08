from fastapi import Header, HTTPException, Depends, Request, status
from typing import Optional
from .crypto import decode_access_token
from .database import get_user_by_id
from .sessions import session_is_active

# Web pages sign in with HttpOnly cookies (page scripts can't read them); apps send a Bearer token.
ACCESS_COOKIE = "mh_access"
REFRESH_COOKIE = "mh_refresh"
WEB_CLIENT_HEADER = "x-muhurtham-client"   # value "web"; required on cookie-signed changes (CSRF)
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> dict:
    """
    The signed-in user, from `Authorization: Bearer <token>` (apps) or the mh_access cookie (web).
    A cookie-signed request that changes data must also send `X-Muhurtham-Client: web`, which
    other websites cannot add; with SameSite=Lax cookies this blocks cross-site request forgery.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expired or invalid token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = None
    if authorization:
        try:
            scheme, token = authorization.split(" ")
            if scheme.lower() != "bearer":
                raise credentials_exception
        except ValueError:
            raise credentials_exception
    else:
        token = request.cookies.get(ACCESS_COOKIE)
        if token and request.method not in SAFE_METHODS and request.headers.get(WEB_CLIENT_HEADER) != "web":
            raise HTTPException(status_code=403, detail="This request was blocked. Please reload the page and try again.")
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception
        
    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception
        
    user = get_user_by_id(user_id)
    if not user:
        raise credentials_exception

    # The token must belong to a session that is still signed in (not logged out or revoked).
    sid = payload.get("sid")
    if not session_is_active(sid, user_id):
        raise credentials_exception
    user["_session_id"] = sid
        
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been disabled."
        )
        
    return user

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Ensure the current user has either admin or super_admin privileges.
    """
    role = current_user.get("role")
    if role not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative permission to perform this action."
        )
    return current_user

async def require_superadmin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Ensure the current user has super_admin privileges.
    """
    role = current_user.get("role")
    if role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted. Only Developers/Super Admins can view system logs."
        )
    return current_user
