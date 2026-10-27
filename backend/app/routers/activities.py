"""
Activities API router.
Serves /activities.
"""
from fastapi import APIRouter
from app.services.activity_service import get_all_activities

router = APIRouter(tags=["Activities"])


@router.get("/activities")
def get_activities():
    """List all activities the app currently has digitized rules for."""
    return get_all_activities()
