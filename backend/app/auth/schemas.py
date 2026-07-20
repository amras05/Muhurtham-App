from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class LoginRequest(BaseModel):
    phone: str = Field(..., description="10-digit clean mobile number")
    password: str = Field(..., description="User password")

class SignupRequest(BaseModel):
    phone: str = Field(..., description="10-digit clean mobile number")
    password: str = Field(..., description="Min 8 characters password")
    confirm_password: str = Field(..., description="Must match password")

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
