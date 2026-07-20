from fastapi import Header, HTTPException, Depends, status
from typing import Optional
from .crypto import decode_access_token
from .database import get_user_by_id

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Validate authorization header token and fetch the current user.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expired or invalid token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not authorization:
        raise credentials_exception
        
    try:
        scheme, token = authorization.split(" ")
        if scheme.lower() != "bearer":
            raise credentials_exception
    except ValueError:
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
