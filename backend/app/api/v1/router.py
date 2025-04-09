"""
Main API v1 router for the application.
"""
from fastapi import APIRouter

from app.api.v1.slack.router import router as slack_router

router = APIRouter(prefix="/v1")

# Include routes from slack router
router.include_router(slack_router)