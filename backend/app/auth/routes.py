"""
Accounts API: sign-up with WhatsApp OTP, password login, sessions (refresh / logout),
password reset, change of mobile, profile, and the admin reads.

Mobile numbers are normalised to E.164 on the way in; `phone` in responses stays 10 digits
for Indian numbers. OTPs are hashed, single-use, rate-limited. Tokens: a 30-minute access
token plus a refresh token tied to a row in app.sessions.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from .crypto import ACCESS_TOKEN_MINUTES, create_access_token, hash_password, needs_rehash, verify_password
from .database import (
    INVITED,
    check_otp,
    create_user,
    get_user_by_id,
    get_user_by_phone,
    log_login_event,
    new_numeric_code,
    store_otp,
    update_user_profile,
    write_activity_log,
)
from .dependencies import get_current_user
from .mobile import mask_mobile, normalize_mobile
from .schemas import (
    ActivityLogResponse,
    ChangeMobileRequest,
    DashboardStatsResponse,
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    MessageResponse,
    OtpSendRequest,
    PasswordResetRequest,
    RefreshRequest,
    ResendOtpRequest,
    SessionResponse,
    SignupRequest,
    UpdateProfileRequest,
    UserInfoResponse,
    UserResponse,
    VerifyOtpRequest,
)
from .sessions import (
    LOGIN_PER_IP_15MIN,
    create_session,
    hit,
    list_sessions,
    lock_minutes,
    login_locked_until,
    otp_send_block,
    record_failed_login,
    revoke_all_sessions,
    revoke_session,
    rotate_refresh,
)
from .whatsapp import send_whatsapp_otp

router = APIRouter()

OTP_MINUTES = 5
MIN_PASSWORD = 8
BAD_MOBILE = "Enter a valid mobile number: 10 digits starting with 6, 7, 8 or 9, or include the country code."
# Same answer whether or not a number has an account, so the endpoint can't be used to find users.
RESET_SENT = "If this number has an account, a code has been sent to its WhatsApp."


# ─── Helpers ──────────────────────────────────────────────

def _ip(req: Request) -> Optional[str]:
    return req.client.host if req.client else None


def _mobile_or_400(raw: str) -> str:
    mobile = normalize_mobile(raw)
    if not mobile:
        raise HTTPException(status_code=400, detail=BAD_MOBILE)
    return mobile


def _check_new_password(password: str, confirm: str) -> None:
    if password != confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    if len(password) < MIN_PASSWORD:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD} characters long.")


def _user_response(u: dict) -> UserResponse:
    return UserResponse(
        id=u["id"], phone=u["phone"], name=u.get("name"), role=u["role"],
        is_verified=bool(u["is_verified"]), is_active=bool(u["is_active"]),
        created_at=u["created_at"], last_login_at=u.get("last_login_at"),
        login_count=u.get("login_count", 0),
    )


def _issue_session(user_id: str, req: Request) -> LoginResponse:
    """New session + tokens for a user who just proved who they are."""
    log_login_event(user_id)
    sid, refresh = create_session(user_id, req.headers.get("user-agent"), _ip(req))
    user = get_user_by_id(user_id)
    token = create_access_token(data={"sub": user_id, "role": user["role"], "sid": sid})
    return LoginResponse(token=token, access_token=token, refresh_token=refresh,
                         expires_in=ACCESS_TOKEN_MINUTES * 60, user=_user_response(user))


def _send_code(mobile: str, purpose: str, req: Request) -> bool:
    """Rate-limited OTP: raises 429 if blocked, else stores and sends a new code."""
    from .app_settings import get_setting
    if not get_setting("otp_sending"):
        raise HTTPException(status_code=503, detail="Sending login codes is paused by the administrator. "
                                                    "Please try again later.")
    blocked = otp_send_block(mobile, _ip(req))
    if blocked:
        why, wait = blocked
        raise HTTPException(status_code=429, detail=why, headers={"Retry-After": str(wait)})
    otp = new_numeric_code()
    store_otp(mobile, otp, datetime.now(timezone.utc) + timedelta(minutes=OTP_MINUTES), purpose=purpose,
              ip_address=_ip(req))
    return send_whatsapp_otp(mobile.lstrip("+"), otp)


def _otp_or_400(mobile: str, code: str, purpose: str) -> None:
    result = check_otp(mobile, code, purpose=purpose)
    if result == "none":
        raise HTTPException(status_code=400, detail="No verification request active for this phone number.")
    if result == "expired":
        raise HTTPException(status_code=400, detail="OTP verification code has expired. Please request a new one.")
    if result == "locked":
        raise HTTPException(status_code=400, detail="Too many wrong codes. Please request a new one.")
    if result != "ok":
        raise HTTPException(status_code=400, detail="Incorrect verification code. Please try again.")


# ─── Sign-up and verification ─────────────────────────────

@router.post("/auth/signup", status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest, req: Request):
    from .app_settings import get_setting
    if not get_setting("signup_open"):
        raise HTTPException(status_code=403, detail="New sign-ups are closed for now. Please contact the administrator.")
    mobile = _mobile_or_400(request.phone)
    _check_new_password(request.password, request.confirm_password)

    existing = get_user_by_phone(mobile)
    if existing and existing.get("is_verified"):
        raise HTTPException(status_code=400, detail="This mobile number is already registered and verified.")

    pwd_hash = hash_password(request.password)
    if existing:
        # Started sign-up before but never confirmed the code: refresh the password (and name).
        fields = {"password_hash": pwd_hash}
        if request.name:
            fields["name"] = request.name.strip()
        update_user_profile(existing["id"], fields)
        user_id = existing["id"]
    else:
        # Every sign-up is a normal user. The first super admin is created on the server
        # with `python -m app.auth.bootstrap`, never by signing up first.
        user_id = create_user(phone=mobile, password_hash=pwd_hash, name=(request.name or "").strip() or None,
                              role="user", is_verified=False)["id"]
    if request.consent_version:
        update_user_profile(user_id, {"consent_version": request.consent_version})

    sent = _send_code(mobile, "signup", req)
    write_activity_log(user_id=user_id, action="signup", details=f"Sign-up started. Code sent: {sent}",
                       ip_address=_ip(req))
    return {"message": "OTP has been successfully sent to your WhatsApp number."}


@router.post("/auth/verify-otp", response_model=LoginResponse)
async def verify_otp(request: VerifyOtpRequest, req: Request):
    mobile = _mobile_or_400(request.phone)
    user = get_user_by_phone(mobile)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")
    _otp_or_400(mobile, request.otp, "signup")

    update_user_profile(user["id"], {"is_verified": 1})
    write_activity_log(user_id=user["id"], action="otp_verify", details="Mobile number verified",
                       ip_address=_ip(req))
    latest = get_user_by_id(user["id"])
    if not latest.get("is_active"):
        raise HTTPException(status_code=403, detail="This account has been disabled.")
    return _issue_session(user["id"], req)


@router.post("/auth/resend-otp")
async def resend_otp(request: ResendOtpRequest, req: Request):
    mobile = _mobile_or_400(request.phone)
    user = get_user_by_phone(mobile)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")
    if user.get("is_verified"):
        raise HTTPException(status_code=400, detail="This number is already verified. Please log in.")
    sent = _send_code(mobile, "signup", req)
    write_activity_log(user_id=user["id"], action="otp_resend", details=f"Code resent. Sent: {sent}",
                       ip_address=_ip(req))
    return {"message": "A new verification code has been sent to your WhatsApp number."}


# ─── Login, sessions ──────────────────────────────────────

@router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest, req: Request):
    if not hit(f"login_ip:{_ip(req)}", 15, LOGIN_PER_IP_15MIN):
        raise HTTPException(status_code=429, detail="Too many login attempts from this network. Please try again later.",
                            headers={"Retry-After": "900"})
    mobile = normalize_mobile(request.phone)
    user = get_user_by_phone(mobile) if mobile else None

    if user and user.get("disabled_reason") == INVITED and user.get("status") == "disabled":
        raise HTTPException(status_code=400, detail="Your account has been created for you. Choose \"Forgot password\" "
                                                    "to get a code on WhatsApp and set your password.")
    if user and login_locked_until(user):
        raise HTTPException(status_code=429,
                            detail=f"Too many wrong passwords. Please try again in {lock_minutes()} minutes "
                                   "or reset your password.")
    if not user or not verify_password(request.password, user.get("password_hash") or ""):
        if user:
            record_failed_login(user["id"])
            write_activity_log(user_id=user["id"], action="login_failed", details="Wrong password",
                               ip_address=_ip(req))
            if login_locked_until(get_user_by_id(user["id"]) or {}):     # this attempt locked the account
                write_activity_log(user_id=user["id"], action="account.locked",
                                   details=f"Locked for {lock_minutes()} minutes after repeated wrong passwords",
                                   ip_address=_ip(req))
        raise HTTPException(status_code=400, detail="Incorrect mobile number or password.")

    if not user.get("is_verified"):
        raise HTTPException(status_code=400,
                            detail="Please verify your mobile number first. An OTP was sent during signup.")
    if not user.get("is_active"):
        raise HTTPException(status_code=403, detail="This account has been disabled.")

    if needs_rehash(user["password_hash"]):          # upgrade older, weaker hashes on the way in
        update_user_profile(user["id"], {"password_hash": hash_password(request.password)})
    write_activity_log(user_id=user["id"], action="login", details="Logged in with mobile + password",
                       ip_address=_ip(req))
    return _issue_session(user["id"], req)


@router.post("/auth/refresh", response_model=LoginResponse)
async def refresh(request: RefreshRequest, req: Request):
    rotated = rotate_refresh(request.refresh_token)
    if not rotated:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    user_id, sid, new_refresh = rotated
    user = get_user_by_id(user_id)
    token = create_access_token(data={"sub": user_id, "role": user["role"], "sid": sid})
    return LoginResponse(token=token, access_token=token, refresh_token=new_refresh,
                         expires_in=ACCESS_TOKEN_MINUTES * 60, user=_user_response(user))


@router.post("/auth/logout", response_model=MessageResponse)
async def logout(request: LogoutRequest, req: Request, current_user: dict = Depends(get_current_user)):
    if request.everywhere:
        n = revoke_all_sessions(current_user["id"])
        write_activity_log(user_id=current_user["id"], action="logout_everywhere",
                           details=f"Signed out {n} device(s)", ip_address=_ip(req))
        return MessageResponse(message="Signed out on every device.")
    revoke_session(current_user["_session_id"], current_user["id"])
    write_activity_log(user_id=current_user["id"], action="logout", details="Signed out", ip_address=_ip(req))
    return MessageResponse(message="Signed out.")


@router.get("/me/sessions", response_model=List[SessionResponse])
async def my_sessions(current_user: dict = Depends(get_current_user)):
    return [SessionResponse(**s, current=(s["id"] == current_user["_session_id"]))
            for s in list_sessions(current_user["id"])]


@router.delete("/me/sessions/{session_id}", response_model=MessageResponse)
async def end_session(session_id: str, req: Request, current_user: dict = Depends(get_current_user)):
    if not revoke_session(session_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="No such signed-in device.")
    write_activity_log(user_id=current_user["id"], action="session_revoke", details="Signed out one device",
                       ip_address=_ip(req), target_type="session", target_id=session_id)
    return MessageResponse(message="That device has been signed out.")


# ─── OTP for password reset and mobile change ─────────────

@router.post("/auth/otp/send", response_model=MessageResponse)
async def send_otp(request: OtpSendRequest, req: Request):
    """
    reset_password: anyone; the reply is the same whether or not the number has an account.
    change_mobile:  signed-in users only (Authorization header); the code goes to the NEW number.
    """
    mobile = _mobile_or_400(request.phone)
    if request.purpose == "reset_password":
        user = get_user_by_phone(mobile)
        if user and user.get("status") != "deleted" and (user.get("is_verified") or user.get("disabled_reason") == INVITED):
            _send_code(mobile, "reset_password", req)
            write_activity_log(user_id=user["id"], action="password_reset_requested", ip_address=_ip(req))
        return MessageResponse(message=RESET_SENT)

    if request.purpose == "change_mobile":
        current_user = await get_current_user(req, req.headers.get("authorization"))
        if get_user_by_phone(mobile):
            raise HTTPException(status_code=400, detail="This number already belongs to an account.")
        _send_code(mobile, "change_mobile", req)
        write_activity_log(user_id=current_user["id"], action="mobile_change_requested",
                           details=f"Code sent to {mask_mobile(mobile)}", ip_address=_ip(req))
        return MessageResponse(message="A code has been sent to the new number's WhatsApp.")

    raise HTTPException(status_code=400, detail="purpose must be reset_password or change_mobile.")


@router.post("/auth/password/reset", response_model=MessageResponse)
async def reset_password(request: PasswordResetRequest, req: Request):
    mobile = _mobile_or_400(request.phone)
    _check_new_password(request.new_password, request.confirm_password)
    user = get_user_by_phone(mobile)
    if not user:
        raise HTTPException(status_code=400, detail="No verification request active for this phone number.")
    _otp_or_400(mobile, request.otp, "reset_password")
    fields = {"password_hash": hash_password(request.new_password), "unlock": True}
    invited = user.get("disabled_reason") == INVITED
    if invited:
        fields["is_verified"] = 1          # the code proves the number: the invitation is accepted
    update_user_profile(user["id"], fields)
    n = revoke_all_sessions(user["id"])
    if invited:
        write_activity_log(user_id=user["id"], action="invite.accepted", details="Set a password and confirmed the mobile",
                           ip_address=_ip(req))
        return MessageResponse(message="Your account is ready. Please log in with your new password.")
    write_activity_log(user_id=user["id"], action="password_reset",
                       details=f"Password reset by OTP; {n} device(s) signed out", ip_address=_ip(req))
    return MessageResponse(message="Password changed. Please log in with the new password.")


@router.post("/me/mobile", response_model=UserResponse)
async def change_mobile(request: ChangeMobileRequest, req: Request, current_user: dict = Depends(get_current_user)):
    new_mobile = _mobile_or_400(request.new_phone)
    if not verify_password(request.password, current_user.get("password_hash") or ""):
        raise HTTPException(status_code=400, detail="Your current password is not correct.")
    if get_user_by_phone(new_mobile):
        raise HTTPException(status_code=400, detail="This number already belongs to an account.")
    _otp_or_400(new_mobile, request.otp, "change_mobile")
    old = current_user["mobile"]
    update_user_profile(current_user["id"], {"mobile": new_mobile})
    revoke_all_sessions(current_user["id"], except_session=current_user["_session_id"])
    write_activity_log(user_id=current_user["id"], action="mobile_change",
                       details=f"{mask_mobile(old)} → {mask_mobile(new_mobile)}; other devices signed out",
                       ip_address=_ip(req))
    return _user_response(get_user_by_id(current_user["id"]))

# The first auth version's /user/profile, /admin/users, /admin/stats and /admin/logs were removed
# on 9 Nov 2026 (plan F1): the web portal uses /me, /admin/people, /admin/statistics and /admin/audit.
