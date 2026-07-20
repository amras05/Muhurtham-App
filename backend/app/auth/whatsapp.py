import logging
import requests

# ─── WhatsApp Business API Settings ────────────────────────
# PASTE YOUR META WHATSAPP BUSINESS API KEY AND ID HERE
# Get your API key from Meta Developer Portal:
# https://developers.facebook.com/docs/whatsapp/cloud-api
WHATSAPP_API_KEY = "PASTE_YOUR_WHATSAPP_BUSINESS_API_KEY_HERE"
WHATSAPP_PHONE_NUMBER_ID = "PASTE_YOUR_WHATSAPP_PHONE_NUMBER_ID_HERE"
WHATSAPP_TEMPLATE_NAME = "otp_verification"  # Approved template name in Meta portal

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

    # Check if API keys are still placeholders
    is_configured = (
        WHATSAPP_API_KEY and 
        "PASTE_YOUR" not in WHATSAPP_API_KEY and 
        WHATSAPP_PHONE_NUMBER_ID and 
        "PASTE_YOUR" not in WHATSAPP_PHONE_NUMBER_ID
    )

    if not is_configured:
        print("\n" + "="*50)
        print(f"💬 [DEV FALLBACK] WHATSAPP OTP FOR +{clean_phone}: {otp}")
        print("="*50 + "\n")
        logger.info(f"Dev Fallback: OTP for +{clean_phone} is {otp}")
        return True

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
            logger.info(f"Successfully sent WhatsApp OTP template to +{clean_phone}")
            return True
        else:
            logger.error(
                f"WhatsApp API error: status={response.status_code}, response={response.text}"
            )
            # Fall back to console print so developers don't get blocked by Meta rejection/API errors
            print(f"⚠️ [WhatsApp Failed - Dev Fallback] OTP for +{clean_phone}: {otp}")
            return False
    except Exception as e:
        logger.error(f"Failed to connect to WhatsApp API: {e}")
        print(f"⚠️ [WhatsApp Connection Error - Dev Fallback] OTP for +{clean_phone}: {otp}")
        return False
