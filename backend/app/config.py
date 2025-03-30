import os
from functools import lru_cache
from typing import Any, Dict, List, Optional, Union

from pydantic import PostgresDsn, SecretStr, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API Settings
    PROJECT_NAME: str = "Toban Contribution Viewer API"
    PROJECT_DESCRIPTION: str = "API for tracking and visualizing contributions across various platforms"
    PROJECT_VERSION: str = "0.1.0"
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]
    
    # Secret Keys
    SECRET_KEY: str
    
    # Database Settings
    DATABASE_URL: PostgresDsn
    DATABASE_TEST_URL: Optional[PostgresDsn] = None
    
    # Authentication Settings
    AUTH0_DOMAIN: str
    AUTH0_CLIENT_ID: str
    AUTH0_CLIENT_SECRET: SecretStr
    AUTH0_AUDIENCE: str
    
    # Third-Party API Keys
    OPENAI_API_KEY: SecretStr
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
            return cls.DATABASE_TEST_URL if cls.DATABASE_TEST_URL else v
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