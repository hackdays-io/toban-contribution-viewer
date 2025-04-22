"""
Main router for Slack API endpoints.
"""

from fastapi import APIRouter

from app.api.v1.slack.analysis import router as analysis_router
from app.api.v1.slack.channels import router as channels_router
from app.api.v1.slack.messages import router as messages_router
from app.api.v1.slack.oauth import router as oauth_router

router = APIRouter(prefix="/slack", tags=["slack"])

# Include routes from oauth.py
router.include_router(oauth_router, prefix="")

# Include routes from channels.py
router.include_router(channels_router, prefix="")

# Include routes from messages.py
router.include_router(messages_router, prefix="")

# Include routes from analysis.py
router.include_router(analysis_router, prefix="")