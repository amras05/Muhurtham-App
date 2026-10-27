"""
Dev-only utilities router.
Gated by MUHURTHAM_ENABLE_DEV_PDF=1.
"""
import base64
import os
from fastapi import APIRouter
from app.core.config import get_settings

router = APIRouter(prefix="/dev", tags=["Dev"])
settings = get_settings()


@router.post("/save-pdf")
def dev_save_pdf(payload: dict):
    """Dev utility: persist a base64 PDF (e.g. generated client-side via pdfmake) to disk."""
    b64 = (payload or {}).get("b64", "")
    name = os.path.basename((payload or {}).get("name", "generated.pdf")) or "generated.pdf"
    out_path = os.path.abspath(
        os.path.join(settings.BASE_DIR, "..", name)
    )
    with open(out_path, "wb") as f:
        f.write(base64.b64decode(b64))
    return {"saved": out_path, "bytes": os.path.getsize(out_path)}
