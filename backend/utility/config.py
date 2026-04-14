from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central configuration loaded from environment variables.
    Supports .env via env_file; environment variables always override .env.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        # ignore unknown keys in .env (useful if you add ENVIRONMENT, etc.)
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql://postgres:admin123@localhost:5432/hagbad"
    )
    secret_key: str = Field(default="CHANGE_ME_IN_PRODUCTION")

    # Development convenience only (turn OFF when using Alembic migrations)
    auto_create_tables: bool = Field(default=False)


settings = Settings()
