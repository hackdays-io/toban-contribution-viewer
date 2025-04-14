import logging
import time
from typing import Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt

from app.config import settings

# Setup the JWT bearer token validation
security = HTTPBearer()


def decode_token(token: str) -> Dict:
    """
    Decode and validate a JWT token from Supabase Auth.

    Args:
        token: JWT token to decode and validate

    Returns:
        Decoded token payload

    Raises:
        HTTPException: If token validation fails
    """
    logger = logging.getLogger(__name__)

    try:
        jwt_secret = settings.SUPABASE_JWT_SECRET
        if not jwt_secret:
            logger.error("JWT secret is not configured")
            raise ValueError("JWT secret is not configured")

        # Try progressive token verification approaches for Supabase compatibility
        supabase_url = settings.SUPABASE_URL.rstrip("/")
        audiences = [supabase_url, f"{supabase_url}/auth/v1"]

        # First approach: Basic verification without audience/issuer checks
        try:
            return jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                options={
                    "verify_signature": True,
                    "verify_aud": False,
                    "verify_iss": False,
                },
            )
        except Exception:
            # Second approach: With audience verification
            try:
                return jwt.decode(
                    token,
                    jwt_secret,
                    algorithms=["HS256"],
                    audience=audiences,
                    options={
                        "verify_signature": True,
                        "verify_aud": True,
                        "verify_iss": False,
                    },
                )
            except Exception:
                # Third approach: With full verification
                try:
                    return jwt.decode(
                        token,
                        jwt_secret,
                        algorithms=["HS256"],
                        audience=audiences,
                        issuer=supabase_url,
                        options={
                            "verify_signature": True,
                            "verify_aud": True,
                            "verify_iss": True,
                        },
                    )
                except Exception as e:
                    logger.error(f"All token verification methods failed: {str(e)}")
                    raise
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict:
    """
    Get the current authenticated user from the JWT token.

    Args:
        credentials: HTTP authorization credentials

    Returns:
        Dictionary with user data extracted from token

    Raises:
        HTTPException: If credentials are invalid or user not found
    """
    # Check if credentials were properly extracted from the request
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication credentials provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get the token from credentials
    token = credentials.credentials

    # Decode the token
    payload = decode_token(token)

    # Validate token expiration
    if payload.get("exp") and time.time() > payload["exp"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user data from the token payload
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Return user data from token
    return {
        "id": user_id,
        "email": payload.get("email", ""),
        "role": payload.get("role", "authenticated"),
    }
