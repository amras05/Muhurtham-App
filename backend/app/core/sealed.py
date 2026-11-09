"""
Sealing personal data before it reaches the database (decision E1): AES-256-GCM with the key in
MUHURTHAM_DATA_KEY (32 random bytes, base64). The key never appears in SQL or database logs.

    blob = seal({"date": "1990-04-12", ...}, aad=owner_id)    # bytes for a bytea column
    data = unseal(blob, aad=owner_id)

`aad` binds a sealed value to its owner: a blob copied onto someone else's row will not open.
Format: 1 version byte (1) + 12-byte nonce + ciphertext with tag.
"""
import base64
import json
import os
import secrets
from typing import Any, Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

import app.core.config  # noqa: F401  (loads backend/.env)

_VERSION = b"\x01"


class DataKeyMissing(RuntimeError):
    pass


def _key() -> bytes:
    raw = os.environ.get("MUHURTHAM_DATA_KEY", "").strip()
    if not raw:
        raise DataKeyMissing("MUHURTHAM_DATA_KEY is not set")
    key = base64.b64decode(raw + "=" * (-len(raw) % 4))
    if len(key) != 32:
        raise DataKeyMissing("MUHURTHAM_DATA_KEY must be 32 bytes (base64)")
    return key


def seal(value: Any, aad: str) -> bytes:
    nonce = secrets.token_bytes(12)
    body = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()
    return _VERSION + nonce + AESGCM(_key()).encrypt(nonce, body, aad.encode())


def unseal(blob: Optional[bytes], aad: str) -> Optional[Any]:
    """None for an empty value. Raises if the blob was changed, belongs to another owner, or the key is wrong."""
    if not blob:
        return None
    blob = bytes(blob)
    if blob[:1] != _VERSION:
        raise ValueError("Unknown sealed-data version")
    return json.loads(AESGCM(_key()).decrypt(blob[1:13], blob[13:], aad.encode()))
