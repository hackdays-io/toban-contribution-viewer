"""
Team API router.
"""

from fastapi import APIRouter

from app.api.v1.team.auth import router as auth_router
from app.api.v1.team.members import router as members_router
from app.api.v1.team.teams import router as teams_router

router = APIRouter(prefix="/teams", tags=["teams"])

# Include routes from team-specific routers
router.include_router(teams_router)
router.include_router(members_router)
router.include_router(auth_router)
