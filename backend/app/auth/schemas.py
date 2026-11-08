from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class LoginRequest(BaseModel):
    phone: str = Field(..., description="10-digit clean mobile number")
    password: str = Field(..., description="User password")

class SignupRequest(BaseModel):
    phone: str = Field(..., description="Mobile number; +91 is assumed for 10 digits")
    password: str = Field(..., description="Min 8 characters password")
    confirm_password: str = Field(..., description="Must match password")
    name: Optional[str] = Field(None, min_length=2, max_length=80, description="Display name (optional for older apps)")
    consent_version: Optional[str] = Field(None, max_length=20, description="Version of the privacy notice accepted")

class VerifyOtpRequest(BaseModel):
    phone: str = Field(..., description="10-digit clean mobile number")
    otp: str = Field(..., description="6-digit verification code")

class ResendOtpRequest(BaseModel):
    phone: str = Field(..., description="10-digit clean mobile number")

class UpdateProfileRequest(BaseModel):
    name: str = Field(..., min_length=2, description="Display name of the user")

# ─── Response Schemas ──────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    phone: str
    name: Optional[str] = None
    role: str
    is_verified: bool
    is_active: bool
    created_at: str
    last_login_at: Optional[str] = None
    login_count: int

class LoginResponse(BaseModel):
    token: str
    access_token: str  # OAuth2 standard compatibility
    token_type: str = "bearer"
    refresh_token: Optional[str] = None   # use with POST /auth/refresh; replaced on every use
    expires_in: int = 1800                # access token lifetime in seconds
    user: UserResponse

class UserInfoResponse(BaseModel):
    id: str
    phone: str
    name: Optional[str] = None
    role: str
    is_verified: bool
    is_active: bool
    created_at: str
    last_login_at: Optional[str] = None
    login_count: int

class ActivityLogResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: str

class DashboardStatsResponse(BaseModel):
    total_users: int
    active_users: int
    verified_users: int
    admin_users: int
    super_admin_users: int
    total_logs: int


# ─── Sessions, OTP, password, mobile ───────────────────────

class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=20)

class LogoutRequest(BaseModel):
    everywhere: bool = Field(False, description="Sign out every device, not just this one")

class OtpSendRequest(BaseModel):
    phone: str = Field(..., description="Mobile number the code goes to")
    purpose: str = Field(..., description="reset_password, or change_mobile (signed in; the NEW number)")

class PasswordResetRequest(BaseModel):
    phone: str
    otp: str = Field(..., min_length=4, max_length=8)
    new_password: str
    confirm_password: str

class ChangeMobileRequest(BaseModel):
    new_phone: str
    otp: str = Field(..., min_length=4, max_length=8, description="Code sent to the new number")
    password: str = Field(..., description="Current password")

class SessionResponse(BaseModel):
    id: str
    device_label: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: str
    last_used_at: Optional[str] = None
    expires_at: str
    current: bool = False

class MessageResponse(BaseModel):
    message: str
