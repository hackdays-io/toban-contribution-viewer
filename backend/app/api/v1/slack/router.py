"""
Main router for Slack API endpoints.
"""
from fastapi import APIRouter

from app.api.v1.slack.oauth import router as oauth_router

router = APIRouter(prefix="/slack", tags=["slack"])

# Include routes from oauth.py
router.include_router(oauth_router, prefix="")