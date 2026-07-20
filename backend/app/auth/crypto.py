import hmac
import hashlib
import base64
import json
import secrets
from datetime import datetime, timedelta

# ─── Secrets Configuration ────────────────────────────────
# In production, load this from environment variables
SECRET_KEY = "muhurtham_super_secret_signing_key_change_in_production"
SALT_ROUNDS = 100000

def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256 with a unique salt."""
    salt = secrets.token_hex(16)
    pwd_bytes = password.encode('utf-8')
    salt_bytes = salt.encode('utf-8')
    
    dk = hashlib.pbkdf2_hmac(
        'sha256', pwd_bytes, salt_bytes, SALT_ROUNDS
    )
    
    hashed = dk.hex()
    return f"{salt}:{hashed}"

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password against its PBKDF2 hash."""
    try:
        salt, hashed = hashed_password.split(":")
        pwd_bytes = password.encode('utf-8')
        salt_bytes = salt.encode('utf-8')
        
        dk = hashlib.pbkdf2_hmac(
            'sha256', pwd_bytes, salt_bytes, SALT_ROUNDS
        )
        
        new_hash = dk.hex()
        return hmac.compare_digest(hashed, new_hash)
    except Exception:
        return False

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
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=1)
        
    to_encode.update({"exp": int(expire.timestamp())})
    
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
        if exp and datetime.utcnow().timestamp() > exp:
            return None
            
        return payload
    except Exception:
        return None
