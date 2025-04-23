"""
Router for cross-resource reports API endpoints.
"""

from fastapi import APIRouter

from app.api.v1.reports.reports import router as reports_router

router = APIRouter(prefix="/reports", tags=["reports"])

# Include routes from reports-specific routers
router.include_router(reports_router)
