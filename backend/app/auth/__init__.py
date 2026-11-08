from .routes import router as auth_router
from .web import router as web_auth_router

__all__ = ["auth_router", "web_auth_router"]
