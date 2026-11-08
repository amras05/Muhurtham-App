"""
Mobile numbers in one format (E.164: +919848012345).

Accepts what people type: spaces, dashes, brackets, a leading 0, a missing +91.
A 10-digit number with no country code is taken as Indian and must start with 6-9.
"""
import re
from typing import Optional

_DIGITS = re.compile(r"\D+")


def normalize_mobile(raw: Optional[str]) -> Optional[str]:
    """E.164 string, or None if it cannot be a valid mobile number."""
    if not raw:
        return None
    text = raw.strip()
    digits = _DIGITS.sub("", text)
    if text.startswith("+") or text.startswith("00"):
        digits = digits[2:] if text.startswith("00") else digits
    elif len(digits) == 11 and digits.startswith("0"):
        digits = "91" + digits[1:]
    elif len(digits) == 10:
        digits = "91" + digits
    if digits.startswith("91"):
        national = digits[2:]
        if len(national) != 10 or national[0] not in "6789":
            return None
    elif not (8 <= len(digits) <= 15) or digits[0] == "0":
        return None
    return "+" + digits


def display_phone(mobile: Optional[str]) -> str:
    """The `phone` value API responses have always returned: 10 digits for India."""
    if not mobile:
        return ""
    return mobile[3:] if mobile.startswith("+91") else mobile.lstrip("+")


def mask_mobile(mobile: Optional[str]) -> str:
    """+91 98•••••345 — for logs and lists."""
    if not mobile or len(mobile) < 7:
        return "•••"
    code = "+91" if mobile.startswith("+91") else mobile[:3]
    rest = mobile[len(code):]
    return f"{code} {rest[:2]}{'•' * max(0, len(rest) - 5)}{rest[-3:]}"
