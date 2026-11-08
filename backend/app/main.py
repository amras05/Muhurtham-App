"""
Muhurtham App — FastAPI application entry point and route registration.

Slim app factory: configures middleware, registers routers, and mounts static assets.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import logger
from app.auth import auth_router
from app.routers.panchang import router as panchang_router
from app.routers.samskara import router as samskara_router
from app.routers.geo import router as geo_router
from app.routers.muhurta_finder import router as muhurta_finder_router
from app.routers.dev import router as dev_router

settings = get_settings()

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(panchang_router)
app.include_router(samskara_router)
app.include_router(geo_router)
app.include_router(muhurta_finder_router)
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
# /files kept as a legacy alias so older shared links resolve
app.mount("/files", StaticFiles(directory=str(settings.WEBAPP_DIR), html=False), name="files")
app.mount("/static", StaticFiles(directory=str(settings.APP_STATIC_DIR)), name="static")

# Catch-all webapp static mount (must be mounted LAST)
app.mount("/", StaticFiles(directory=str(settings.WEBAPP_DIR), html=True), name="webapp")
