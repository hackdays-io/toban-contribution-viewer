from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Toban Contribution Viewer API"
    PROJECT_DESCRIPTION: str = "API for tracking and visualizing contributions across various platforms"
    PROJECT_VERSION: str = "0.1.0"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()