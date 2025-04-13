import os
from functools import lru_cache
from typing import Any, List, Optional

from pydantic import PostgresDsn, SecretStr, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API Settings
    PROJECT_NAME: str = "Toban Contribution Viewer API"
    PROJECT_DESCRIPTION: str = (
        "API for tracking and visualizing contributions across various platforms"
    )
    PROJECT_VERSION: str = "0.1.0"
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    API_URL: Optional[str] = (
        None  # Base URL for the API, used for constructing callback URLs (e.g., ngrok URL)
    )
    FRONTEND_URL: Optional[str] = (
        None  # Base URL for the frontend, used for redirects (e.g., ngrok app URL)
    )
    ADDITIONAL_CORS_ORIGINS: str = ""  # Comma-separated list of additional CORS origins
    ALLOWED_HOSTS: List[str] = [
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        # Allow ngrok domains for development
        "https://*.ngrok-free.app",
        "https://*.ngrok.io",
    ]

    @validator("ALLOWED_HOSTS", pre=True)
    def add_additional_cors_origins(cls, v, values):
        """Add any additional CORS origins from the environment."""
        allowed_hosts = list(v)
        additional_cors = values.get("ADDITIONAL_CORS_ORIGINS", "")

        # Add specific NGROK_URL if it exists
        ngrok_url = os.environ.get("NGROK_URL")
        if ngrok_url and ngrok_url.strip():
            allowed_hosts.append(ngrok_url.strip())

        if additional_cors:
            # Split by comma and filter out empty strings
            origins = [
                origin.strip()
                for origin in additional_cors.split(",")
                if origin.strip()
            ]
            allowed_hosts.extend(origins)

        # CORS security in browsers typically doesn't support wildcards,
        # so we need to add specific domains
        explicit_allowed_hosts = []
        for host in allowed_hosts:
            explicit_allowed_hosts.append(host)

            # Handle wildcards in ngrok domains
            if ("*.ngrok-free.app" in host or "*.ngrok.io" in host) and ngrok_url:
                # If we have ngrok URL and we're dealing with a wildcard ngrok domain,
                # add the specific domain explicitly
                if "ngrok-free.app" in ngrok_url or "ngrok.io" in ngrok_url:
                    explicit_allowed_hosts.append(ngrok_url)

        # Always ensure summary-locust-arriving.ngrok-free.app is included
        if (
            "https://summary-locust-arriving.ngrok-free.app"
            not in explicit_allowed_hosts
        ):
            explicit_allowed_hosts.append(
                "https://summary-locust-arriving.ngrok-free.app"
            )

        return explicit_allowed_hosts

    # Secret Keys
    SECRET_KEY: str

    # Database Settings
    DATABASE_URL: PostgresDsn
    DATABASE_TEST_URL: Optional[PostgresDsn] = None

    # Authentication Settings
    SUPABASE_URL: str
    SUPABASE_KEY: SecretStr
    SUPABASE_JWT_SECRET: str

    # Third-Party API Keys
    OPENAI_API_KEY: SecretStr
    OPENROUTER_API_KEY: Optional[SecretStr] = None
    OPENROUTER_DEFAULT_MODEL: str = "anthropic/claude-3-sonnet:20240229"
    OPENROUTER_MAX_TOKENS: int = 4000
    OPENROUTER_TEMPERATURE: float = 0.7
    SLACK_CLIENT_ID: Optional[str] = None
    SLACK_CLIENT_SECRET: Optional[SecretStr] = None
    SLACK_SIGNING_SECRET: Optional[SecretStr] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[SecretStr] = None
    NOTION_API_KEY: Optional[SecretStr] = None

    # Feature Flags
    ENABLE_SLACK_INTEGRATION: bool = True
    ENABLE_GITHUB_INTEGRATION: bool = True
    ENABLE_NOTION_INTEGRATION: bool = True

    # Logging
    LOG_LEVEL: str = "INFO"

    # Validators
    @validator("DATABASE_URL", pre=True)
    def validate_database_url(cls, v: Optional[str]) -> Any:
        if os.environ.get("TESTING") == "True":
            # Use test database during testing
            test_url = os.environ.get("DATABASE_TEST_URL")
            return test_url if test_url else v
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """
    Get application settings from environment variables.

    Using lru_cache to avoid reloading settings for each request.
    """
    return Settings()


settings = get_settings()
