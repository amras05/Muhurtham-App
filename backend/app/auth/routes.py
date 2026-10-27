from .database import get_user_by_id
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request, Query, status
from typing import List, Optional

from .crypto import hash_password, verify_password, create_access_token
from .database import (
    get_user_by_phone,
    create_user,
    store_otp,
    get_otp,
    delete_otp,
    update_user_profile,
    log_login_event,
    write_activity_log,
    fetch_all_users,
    fetch_system_statistics,
    fetch_activity_logs
)
from .whatsapp import send_whatsapp_otp
from .dependencies import get_current_user, require_admin, require_superadmin
from .schemas import (
    LoginRequest,
    SignupRequest,
    VerifyOtpRequest,
    ResendOtpRequest,
    UpdateProfileRequest,
    UserResponse,
    LoginResponse,
    UserInfoResponse,
    ActivityLogResponse,
    DashboardStatsResponse
)

router = APIRouter()

def generate_numeric_otp() -> str:
    """Generate a secure 6-digit random verification code."""
    return "".join(secrets.choice("0123456789") for _ in range(6))

# ─── Auth Endpoints ───────────────────────────────────────

@router.post("/auth/signup", status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest, req: Request):
    phone = "".join(filter(str.isdigit, request.phone))
    
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid mobile number format.")
        
    if request.password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    # Check password strength
    if len(request.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long."
        )

    existing_user = get_user_by_phone(phone)
    if existing_user:
        if existing_user.get("is_verified"):
            raise HTTPException(
                status_code=400,
                detail="This mobile number is already registered and verified."
            )
        else:
            # User initiated signup before but didn't verify OTP.
            # Allow updating their password hash and triggering a new OTP.
            pwd_hash = hash_password(request.password)
            update_user_profile(existing_user["id"], {"password_hash": pwd_hash})
            user_id = existing_user["id"]
    else:
        # Create unverified user account
        pwd_hash = hash_password(request.password)
        # Default first user to superadmin if developers/testing, else standard user
        # This allows initial setup ease. If no users exist, default to superadmin
        all_users = fetch_all_users()
        role = "super_admin" if len(all_users) == 0 else "user"
        
        user_info = create_user(
            phone=phone,
            password_hash=pwd_hash,
            role=role,
            is_verified=False
        )
        user_id = user_info["id"]

    # Generate and store OTP
    otp = generate_numeric_otp()
    expiry = datetime.utcnow() + timedelta(minutes=5)
    store_otp(phone, otp, expiry)
    
    # Dispatch OTP via WhatsApp cloud template
    whatsapp_success = send_whatsapp_otp(phone, otp)
    
    write_activity_log(
        user_id=user_id,
        action="signup",
        details=f"Initiated signup. WhatsApp OTP sent: {whatsapp_success}",
        ip_address=req.client.host if req.client else None
    )

    return {"message": "OTP has been successfully sent to your WhatsApp number."}

@router.post("/auth/verify-otp", response_model=LoginResponse)
async def verify_otp(request: VerifyOtpRequest, req: Request):
    phone = "".join(filter(str.isdigit, request.phone))
    
    user = get_user_by_phone(phone)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    otp_record = get_otp(phone)
    if not otp_record:
        raise HTTPException(status_code=400, detail="No verification request active for this phone number.")

    # Check expiration
    expires_at = datetime.fromisoformat(otp_record["expires_at"])
    if datetime.utcnow() > expires_at:
        delete_otp(phone)
        raise HTTPException(status_code=400, detail="OTP verification code has expired. Please request a new one.")

    # Match OTP
    if otp_record["code"] != request.otp:
        raise HTTPException(status_code=400, detail="Incorrect verification code. Please try again.")

    # Mark user as verified
    update_user_profile(user["id"], {"is_verified": 1})
    delete_otp(phone)
    
    # Log successful verification
    write_activity_log(
        user_id=user["id"],
        action="otp_verify",
        details="Successfully verified mobile number via OTP",
        ip_address=req.client.host if req.client else None
    )
    
    log_login_event(user["id"])
    
    # Generate session tokens
    token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    
    # Refetch latest user profile
    latest_user = get_user_by_id(user["id"])
    
    # format output response
    user_response = UserResponse(
        id=latest_user["id"],
        phone=latest_user["phone"],
        name=latest_user.get("name"),
        role=latest_user["role"],
        is_verified=bool(latest_user["is_verified"]),
        is_active=bool(latest_user["is_active"]),
        created_at=latest_user["created_at"],
        last_login_at=latest_user.get("last_login_at"),
        login_count=latest_user.get("login_count", 0)
    )
    
    return LoginResponse(
        token=token,
        access_token=token,
        user=user_response
    )

@router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest, req: Request):
    phone = "".join(filter(str.isdigit, request.phone))
    
    user = get_user_by_phone(phone)
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=400,
            detail="Incorrect mobile number or password."
        )

    if not user.get("is_verified"):
        raise HTTPException(
            status_code=400,
            detail="Please verify your mobile number first. An OTP was sent during signup."
        )

    if not user.get("is_active"):
        raise HTTPException(
            status_code=403,
            detail="This account has been disabled."
        )

    # Log login success
    log_login_event(user["id"])
    write_activity_log(
        user_id=user["id"],
        action="login",
        details="Logged in using phone + password",
        ip_address=req.client.host if req.client else None
    )

    token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    latest_user = get_user_by_id(user["id"])
    
    user_response = UserResponse(
        id=latest_user["id"],
        phone=latest_user["phone"],
        name=latest_user.get("name"),
        role=latest_user["role"],
        is_verified=bool(latest_user["is_verified"]),
        is_active=bool(latest_user["is_active"]),
        created_at=latest_user["created_at"],
        last_login_at=latest_user.get("last_login_at"),
        login_count=latest_user.get("login_count", 0)
    )
    
    return LoginResponse(
        token=token,
        access_token=token,
        user=user_response
    )

@router.post("/auth/resend-otp")
async def resend_otp(request: ResendOtpRequest, req: Request):
    phone = "".join(filter(str.isdigit, request.phone))
    
    user = get_user_by_phone(phone)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    otp = generate_numeric_otp()
    expiry = datetime.utcnow() + timedelta(minutes=5)
    store_otp(phone, otp, expiry)
    
    whatsapp_success = send_whatsapp_otp(phone, otp)
    
    write_activity_log(
        user_id=user["id"],
        action="otp_resend",
        details=f"Resent WhatsApp OTP. Successful: {whatsapp_success}",
        ip_address=req.client.host if req.client else None
    )

    return {"message": "A new verification code has been sent to your WhatsApp number."}

# ─── User Profile Endpoints ───────────────────────────────

@router.get("/user/profile", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        phone=current_user["phone"],
        name=current_user.get("name"),
        role=current_user["role"],
        is_verified=bool(current_user["is_verified"]),
        is_active=bool(current_user["is_active"]),
        created_at=current_user["created_at"],
        last_login_at=current_user.get("last_login_at"),
        login_count=current_user.get("login_count", 0)
    )

@router.put("/user/profile", response_model=UserResponse)
async def update_profile(
    request: UpdateProfileRequest,
    req: Request,
    current_user: dict = Depends(get_current_user)
):
    update_user_profile(current_user["id"], {"name": request.name})
    
    write_activity_log(
        user_id=current_user["id"],
        action="profile_update",
        details=f"Updated profile name to '{request.name}'",
        ip_address=req.client.host if req.client else None
    )
    
    latest_user = get_user_by_id(current_user["id"])
    return UserResponse(
        id=latest_user["id"],
        phone=latest_user["phone"],
        name=latest_user.get("name"),
        role=latest_user["role"],
        is_verified=bool(latest_user["is_verified"]),
        is_active=bool(latest_user["is_active"]),
        created_at=latest_user["created_at"],
        last_login_at=latest_user.get("last_login_at"),
        login_count=latest_user.get("login_count", 0)
    )

# ─── Admin Endpoints ──────────────────────────────────────

@router.get("/admin/users", response_model=List[UserInfoResponse])
async def list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    admin_user: dict = Depends(require_admin)
):
    users = fetch_all_users(search=search, role=role)
    return [
        UserInfoResponse(
            id=u["id"],
            phone=u["phone"],
            name=u.get("name"),
            role=u["role"],
            is_verified=bool(u["is_verified"]),
            is_active=bool(u["is_active"]),
            created_at=u["created_at"],
            last_login_at=u.get("last_login_at"),
            login_count=u.get("login_count", 0)
        )
        for u in users
    ]

@router.get("/admin/stats", response_model=DashboardStatsResponse)
async def get_stats(admin_user: dict = Depends(require_admin)):
    stats = fetch_system_statistics()
    return DashboardStatsResponse(**stats)

# ─── Super Admin Endpoints ────────────────────────────────

@router.get("/admin/logs", response_model=List[ActivityLogResponse])
async def get_logs(
    user_id: Optional[str] = Query(None),
    superadmin_user: dict = Depends(require_superadmin)
):
    logs = fetch_activity_logs(user_id=user_id)
    return [
        ActivityLogResponse(
            id=log["id"],
            user_id=log["user_id"],
            user_name=log.get("user_name"),
            action=log["action"],
            details=log.get("details"),
            ip_address=log.get("ip_address"),
            timestamp=log["timestamp"]
        )
        for log in logs
    ]
