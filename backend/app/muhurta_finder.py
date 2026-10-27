"""
Re-export shim during refactoring migration.
Canonical source: app.routers.muhurta and app.services.muhurta_finder_service
"""
from app.routers.muhurta import router, muhurta_finder
from app.services.muhurta_finder_service import find_muhurtas
