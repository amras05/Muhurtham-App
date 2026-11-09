"""
PDF downloads (plan R8).

  POST /pdf/render   {kind, title, subtitle?, lang, html, filename?}  →  application/pdf

`html` is the section of the page the person is looking at; see app/pdf/render.py for how it is
cleaned and which files the renderer may load. Signed-in people only, 30 PDFs per 10 minutes each.
Every download is logged as `pdf.download` with the kind only (no names or birth details).
"""
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.auth.database import write_activity_log
from app.auth.dependencies import get_current_user
from app.auth.sessions import hit
from app.core.logging import logger
from app.pdf.render import KINDS, render_pdf

router = APIRouter(prefix="/pdf", tags=["PDF"])

MAX_HTML = 1_500_000          # characters; a full muhurta detail is about 60–120k
PER_10_MIN = 30


class PdfRequest(BaseModel):
    kind: str = Field(..., pattern="^(" + "|".join(KINDS) + ")$")
    title: str = Field(..., min_length=1, max_length=160)
    subtitle: Optional[str] = Field(None, max_length=300)
    lang: str = Field("en", pattern="^(te|en)$")
    html: str = Field(..., min_length=1, max_length=MAX_HTML)
    filename: Optional[str] = Field(None, max_length=120)


def _safe_filename(name: Optional[str], kind: str) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", (name or f"muhurtham_{kind}")).strip("._") or f"muhurtham_{kind}"
    return (base[:100] if base.lower().endswith(".pdf") else base[:96] + ".pdf")


@router.post("/render")
def render(body: PdfRequest, req: Request, current_user: dict = Depends(get_current_user)) -> Response:
    if not hit(f"pdf:{current_user['id']}", 10, PER_10_MIN):
        raise HTTPException(status_code=429, detail="Too many PDFs in a short time. Please wait a few minutes.",
                            headers={"Retry-After": "600"})
    try:
        pdf = render_pdf(body.kind, body.title, body.subtitle, body.html, body.lang)
    except Exception:
        logger.exception("PDF rendering failed (kind=%s)", body.kind)
        raise HTTPException(status_code=500, detail="The PDF could not be made. Please try again.")
    write_activity_log(user_id=current_user["id"], action="pdf.download", details=body.kind,
                       ip_address=req.client.host if req.client else None, target_type="pdf")
    name = _safe_filename(body.filename, body.kind)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{name}"', "Cache-Control": "no-store"})
