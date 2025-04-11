import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router as api_router
from app.config import settings
from app.core.env_test import check_env

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Check environment variables on startup
if not check_env(exit_on_error=False):
    logger.warning("Application started with environment configuration issues")

# Background task for Slack token verification
background_tasks = set()

# Define lifespan context manager to handle startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Schedule background tasks
    if settings.ENABLE_SLACK_INTEGRATION:
        # Import here to avoid circular imports
        from app.services.slack.tasks import schedule_background_tasks

        # Start background task for token verification
        task = asyncio.create_task(schedule_background_tasks())
        background_tasks.add(task)
        task.add_done_callback(background_tasks.discard)
        
        logger.info("Started Slack background tasks")
    
    yield
    
    # Shutdown: Cancel any running background tasks
    for task in background_tasks:
        task.cancel()
    
    # Wait for all tasks to complete with a timeout
    if background_tasks:
        await asyncio.gather(*background_tasks, return_exceptions=True)
        logger.info("Background tasks cancelled")

# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.ALLOWED_HOSTS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to Toban Contribution Viewer API"}


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok"}


# Include API routes
app.include_router(api_router)
