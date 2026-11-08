"""
Muhurtham App — FastAPI application entry point and route registration.

Slim app factory: configures middleware, registers routers, and mounts static assets.
"""
import secrets

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import logger
from fastapi import Depends

from app.auth import auth_router, web_auth_router
from app.auth.dependencies import get_current_user
from app.auth.guard import PageGuard
from app.routers.panchang import router as panchang_router
from app.routers.samskara import router as samskara_router
from app.routers.geo import router as geo_router
from app.routers.muhurta_finder import router as muhurta_finder_router
from app.routers.dev import router as dev_router
from app.routers.portal import router as portal_router
from app.routers.admin import router as admin_router
from app.routers.content import router as content_router

settings = get_settings()

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
)

# CORS middleware
app.add_middleware(PageGuard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Include Routers
@app.exception_handler(DBAPIError)
async def database_error(request: Request, exc: DBAPIError):
    """
    A database failure becomes a readable 503, not a bare 500. Lost connections are dropped
    from the pool so the next request opens fresh ones. The traceback (with query values
    hidden by the engine) goes to the server log under a short reference.
    """
    ref = secrets.token_hex(4)
    logger.error("Database error ref=%s on %s %s", ref, request.method, request.url.path, exc_info=exc)
    if exc.connection_invalidated or isinstance(exc, (OperationalError, InterfaceError)):
        from app.db.engine import app_engine
        app_engine().dispose()
    return JSONResponse(status_code=503, content={
        "detail": f"The server could not reach the database. Please try again in a moment. (ref {ref})"})


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    """Any other crash: logged with a reference, answered as JSON the pages can show."""
    ref = secrets.token_hex(4)
    logger.error("Unhandled error ref=%s on %s %s", ref, request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={
        "detail": f"Something went wrong on the server. Please try again. (ref {ref})"})


# Every data endpoint needs a signed-in session (cookie on the web, Bearer token in apps).
SIGNED_IN = [Depends(get_current_user)]

app.include_router(auth_router)
app.include_router(web_auth_router)
app.include_router(panchang_router, dependencies=SIGNED_IN)
app.include_router(samskara_router, dependencies=SIGNED_IN)
app.include_router(geo_router, dependencies=SIGNED_IN)
app.include_router(muhurta_finder_router, dependencies=SIGNED_IN)
app.include_router(portal_router)
app.include_router(admin_router)
app.include_router(content_router)
if settings.ENABLE_DEV_PDF:
    app.include_router(dev_router)


# Root endpoints
@app.get("/health")
def health():
    return {"status": "ok", "version": app.version, "dev_pdf": settings.ENABLE_DEV_PDF}


@app.get("/", include_in_schema=False)
def serve_root():
    """Serve the main app page at the server root."""
    index_file = settings.WEBAPP_DIR / "panchang-lookup.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Muhurtham Backend API is running", "docs_url": "/docs"}


@app.get("/index.html", include_in_schema=False)
def serve_index_redirect():
    return RedirectResponse(url="/", status_code=302)


# Re-exports for backward compatibility
from app.services.muhurta_service import compute_pushkara_window, compute_d1_positions

# Static file mounts
class WebappFiles(StaticFiles):
    """Pages, CSS and JS: the browser must check with the server on every load (a cheap 304 when
    unchanged). Without this, browsers keep using an old stylesheet or script after an update."""
    def file_response(self, *args, **kwargs):
        resp = super().file_response(*args, **kwargs)
        resp.headers["Cache-Control"] = "no-cache"
        return resp


# /files kept as a legacy alias so older shared links resolve
app.mount("/files", WebappFiles(directory=str(settings.WEBAPP_DIR), html=False), name="files")
app.mount("/static", StaticFiles(directory=str(settings.APP_STATIC_DIR)), name="static")

# Catch-all webapp static mount (must be mounted LAST)
app.mount("/", WebappFiles(directory=str(settings.WEBAPP_DIR), html=True), name="webapp")
