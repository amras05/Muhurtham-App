import hmac
import hashlib
import base64
import json
import secrets
from datetime import datetime, timedelta, timezone

# ─── Secrets Configuration ────────────────────────────────
from app.core.config import SECRET_KEY

# Passwords: PBKDF2-HMAC-SHA256. New hashes are "pbkdf2_sha256$<iterations>$<salt>$<hex>".
# Hashes made before this change ("<salt>:<hex>", 100,000 iterations) still verify and are
# upgraded on the next successful login (see needs_rehash).
PASSWORD_ITERATIONS = 600_000
LEGACY_ITERATIONS = 100_000

# Access tokens are short; a session's refresh token (app.sessions) keeps the user signed in.
ACCESS_TOKEN_MINUTES = 30


def _pbkdf2(password: str, salt: str, iterations: int) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations).hex()


def hash_password(password: str) -> str:
    """Hash a password with a unique salt."""
    salt = secrets.token_hex(16)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt}${_pbkdf2(password, salt, PASSWORD_ITERATIONS)}"


def verify_password(password: str, hashed_password: str) -> bool:
    """Check a password against a stored hash (current or legacy format)."""
    if not password or not hashed_password:
        return False
    try:
        if hashed_password.startswith("pbkdf2_sha256$"):
            _, iterations, salt, hashed = hashed_password.split("$", 3)
            return hmac.compare_digest(hashed, _pbkdf2(password, salt, int(iterations)))
        salt, hashed = hashed_password.split(":", 1)
        return hmac.compare_digest(hashed, _pbkdf2(password, salt, LEGACY_ITERATIONS))
    except (ValueError, TypeError):
        return False


def needs_rehash(hashed_password: str) -> bool:
    return not (hashed_password or "").startswith(f"pbkdf2_sha256${PASSWORD_ITERATIONS}$")

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def _base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    Generate a secure JWT-compliant token using HMAC-SHA256.
    Avoids requiring third-party library compilation/installs on Windows.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
        
    to_encode.update({"exp": int(expire.timestamp()), "iat": int(datetime.now(timezone.utc).timestamp())})
    
    header = {"alg": "HS256", "typ": "JWT"}
    
    header_b64 = _base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = _base64url_encode(json.dumps(to_encode).encode('utf-8'))
    
    signature_base = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(
        SECRET_KEY.encode('utf-8'), signature_base, hashlib.sha256
    ).digest()
    
    signature_b64 = _base64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def decode_access_token(token: str) -> dict | None:
    """Verify and decode the signature of the access token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
            
        header_b64, payload_b64, signature_b64 = parts
        
        # Verify signature
        signature_base = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(
            SECRET_KEY.encode('utf-8'), signature_base, hashlib.sha256
        ).digest()
        
        actual_sig = _base64url_decode(signature_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
            
        # Decode and check expiry
        payload = json.loads(_base64url_decode(payload_b64).decode('utf-8'))
        exp = payload.get("exp")
        if not exp or datetime.now(timezone.utc).timestamp() > exp:
            return None
            
        return payload
    except Exception:
        return None
