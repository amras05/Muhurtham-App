import logging
import requests

import os

import app.core.config  # noqa: F401  (loads backend/.env)
from app.auth.mobile import mask_mobile

# ─── WhatsApp Business API Settings ────────────────────────
# From the environment only (backend/.env locally, the server's env in production).
# Meta Developer Portal: https://developers.facebook.com/docs/whatsapp/cloud-api
WHATSAPP_API_KEY = os.environ.get("MUHURTHAM_WHATSAPP_TOKEN", "").strip()
WHATSAPP_PHONE_NUMBER_ID = os.environ.get("MUHURTHAM_WHATSAPP_PHONE_NUMBER_ID", "").strip()
WHATSAPP_TEMPLATE_NAME = os.environ.get("MUHURTHAM_WHATSAPP_TEMPLATE", "otp_verification").strip()
# Print codes to the console only when explicitly asked (development without WhatsApp).
OTP_DEV_ECHO = os.environ.get("MUHURTHAM_OTP_DEV_ECHO", "0").strip() == "1"

logger = logging.getLogger("auth.whatsapp")

def send_whatsapp_otp(phone: str, otp: str) -> bool:
    """
    Send verification OTP code via WhatsApp Cloud API.
    
    If the WHATSAPP_API_KEY is not configured or placeholder is present, 
    it falls back to logging the OTP to the console, allowing you to 
    seamlessly sign up and test the application during development.
    """
    # Normalize phone: remove non-digits
    clean_phone = "".join(filter(str.isdigit, phone))
    
    # Ensure country code is prefixed
    if not clean_phone.startswith("91") and len(clean_phone) == 10:
        clean_phone = "91" + clean_phone

    is_configured = bool(WHATSAPP_API_KEY and WHATSAPP_PHONE_NUMBER_ID)
    shown = mask_mobile("+" + clean_phone)

    if not is_configured:
        if OTP_DEV_ECHO:
            # Development only: printed to the terminal, never written to the log.
            print(f"\n[DEV OTP] code for {shown}: {otp}\n", flush=True)
            return True
        logger.error("WhatsApp is not configured (MUHURTHAM_WHATSAPP_TOKEN / _PHONE_NUMBER_ID); OTP not sent to %s", shown)
        return False

    url = f"https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Standard template payload format requested by Meta API
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "template",
        "template": {
            "name": WHATSAPP_TEMPLATE_NAME,
            "language": {
                "code": "en_US"
            },
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {
                            "type": "text",
                            "text": otp
                        }
                    ]
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [
                        {
                            "type": "text",
                            "text": otp
                        }
                    ]
                }
            ]
        }
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code in (200, 201):
            logger.info("WhatsApp OTP sent to %s", shown)
            return True
        else:
            logger.error("WhatsApp API error for %s: status=%s, response=%s",
                         shown, response.status_code, response.text[:300])
            if OTP_DEV_ECHO:
                print(f"\n[DEV OTP] WhatsApp failed; code for {shown}: {otp}\n", flush=True)
            return False
    except Exception as e:
        logger.error("Could not reach the WhatsApp API for %s: %s", shown, e)
        if OTP_DEV_ECHO:
            print(f"\n[DEV OTP] WhatsApp unreachable; code for {shown}: {otp}\n", flush=True)
        return False
