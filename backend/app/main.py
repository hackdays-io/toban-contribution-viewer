import asyncio
import logging
import os
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
allowed_origins = [str(origin) for origin in settings.ALLOWED_HOSTS]
# Log all allowed origins for debugging
logger.info(f"CORS allowed origins: {allowed_origins}")
# Fix for ngrok domains - ensure specific ngrok domain is included
ngrok_url = os.environ.get("NGROK_URL")
if ngrok_url and ngrok_url not in allowed_origins:
    allowed_origins.append(ngrok_url)
    logger.info(f"Added ngrok URL to allowed origins: {ngrok_url}")

# Let's print the exact allowed origins for debugging
logger.info(f"CORS allowed origins (exact list): {allowed_origins}")

# Make sure specific ngrok URL is included for development
ngrok_url = os.environ.get("NGROK_URL")
if settings.DEBUG and ngrok_url and ngrok_url not in allowed_origins:
    allowed_origins.append(ngrok_url)
    logger.info(f"Added ngrok URL to allowed origins: {ngrok_url}")

# Configure CORS middleware with appropriate settings for the environment
app.add_middleware(
    CORSMiddleware,
    # Only use strict origin checking in production
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept"],
    expose_headers=["Content-Length", "Content-Range"],
)


# Root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to Toban Contribution Viewer API"}


# Handle preflight OPTIONS requests explicitly - only in development mode
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    # This is a fallback for development only
    if not settings.DEBUG:
        # In production, let the standard CORS middleware handle OPTIONS requests
        return {"detail": "Production mode - standard CORS handling applies"}
    return {"detail": "OK"}


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok"}


# CORS debug endpoint - useful for troubleshooting CORS issues
@app.get("/cors-debug")
async def cors_debug():
    """Return CORS configuration for debugging."""
    return {
        "allowed_origins": [str(origin) for origin in settings.ALLOWED_HOSTS],
        "additional_cors_origins": os.environ.get("ADDITIONAL_CORS_ORIGINS", ""),
        "ngrok_url": os.environ.get("NGROK_URL", ""),
        "api_url": settings.API_URL,
        "frontend_url": settings.FRONTEND_URL,
        "debug_mode": settings.DEBUG,
    }


# JWT debug endpoint - useful for troubleshooting JWT issues
@app.get("/auth-debug")
async def auth_debug():
    """Return JWT configuration for debugging."""
    import base64
    import hashlib

    # Get the JWT secret for debugging
    jwt_secret = settings.SUPABASE_JWT_SECRET

    # Safely prepare information for response
    try:
        # Create a safe preview of the secret (first few chars only)
        safe_secret = jwt_secret[:5] + "..." if jwt_secret else "Not configured"

        # Determine if it's base64 encoded and its length
        if jwt_secret:
            try:
                decoded = base64.b64decode(jwt_secret)
                is_base64 = True
                secret_length = len(decoded)
                # Create a hash for comparison without revealing the actual secret
                secret_hash = hashlib.sha256(decoded).hexdigest()[:8]
            except Exception:
                is_base64 = False
                secret_length = len(jwt_secret)
                secret_hash = hashlib.sha256(jwt_secret.encode("utf-8")).hexdigest()[:8]

            # Test if the secret can be used for JWT operations
            from jose import jwt

            try:
                test_payload = {"sub": "test", "exp": 1000000000000}
                test_token = jwt.encode(test_payload, jwt_secret, algorithm="HS256")
                jwt.decode(test_token, jwt_secret, algorithms=["HS256"])
                secret_valid = True
            except Exception:
                secret_valid = False
        else:
            is_base64 = False
            secret_length = 0
            secret_hash = None
            secret_valid = False
    except Exception:
        safe_secret = "Error analyzing secret"
        is_base64 = False
        secret_length = 0
        secret_hash = None
        secret_valid = False

    # Return auth configuration information
    return {
        "jwt_auth_configured": bool(jwt_secret),
        "jwt_secret_preview": safe_secret,
        "jwt_secret_is_base64": is_base64,
        "jwt_secret_length": secret_length,
        "jwt_secret_hash": secret_hash,
        "jwt_secret_valid": secret_valid,
        "supabase_url": settings.SUPABASE_URL,
        "supabase_jwt_secret_configured": bool(settings.SUPABASE_JWT_SECRET),
        "api_url": settings.API_URL,
        "frontend_url": settings.FRONTEND_URL,
    }


# Add custom CORS middleware only for development
@app.middleware("http")
async def add_cors_headers(request, call_next):
    response = await call_next(request)
    
    # Only apply this in debug/development mode
    if not settings.DEBUG:
        return response
        
    # Check if the Origin header exists in the request
    origin = request.headers.get("Origin")
    ngrok_url = os.environ.get("NGROK_URL")
    
    # Only allow specific origins that are configured in environment
    if origin and (
        origin in allowed_origins or 
        (ngrok_url and origin == ngrok_url) or
        (origin.endswith('.ngrok-free.app') or origin.endswith('.ngrok.io'))
    ):
        # Add CORS headers
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = (
            "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        )
        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization, X-Requested-With, Accept"
        )
    
    return response


# Include API routes
app.include_router(api_router)
