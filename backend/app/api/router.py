"""
Main API router for the application.
"""

from fastapi import APIRouter

from app.api.v1.router import router as v1_router

router = APIRouter(prefix="/api")

# Include routes from API v1 router
router.include_router(v1_router)
