"""
Main API v1 router for the application.
"""

from fastapi import APIRouter

from app.api.v1.integration.router import router as integration_router
from app.api.v1.slack.router import router as slack_router
from app.api.v1.team.router import router as team_router

router = APIRouter(prefix="/v1")

# Include routes from other routers
router.include_router(slack_router)
router.include_router(team_router)
router.include_router(integration_router, prefix="/integrations", tags=["integrations"])
