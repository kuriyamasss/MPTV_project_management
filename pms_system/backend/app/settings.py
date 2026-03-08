from __future__ import annotations

import json
import secrets
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "MPTV Project Management API"
    APP_ENV: Literal["dev", "prod"] = "dev"
    APP_VERSION: str = "2.0.0"

    DATABASE_URL: str = "postgresql+psycopg://mptv:mptv@postgres:5432/mptv"
    JWT_SECRET_KEY: str = "dev-only-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    CORS_ORIGINS: str = "http://localhost:5173"

    REQUEST_TIMEOUT_SECONDS: int = 30
    MAX_UPLOAD_SIZE_MB: int = 20

    LOGIN_RATE_LIMIT_ATTEMPTS: int = 10
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 300

    S3_ENDPOINT_URL: str = "http://minio:9000"
    S3_REGION: str = "us-east-1"
    S3_BUCKET: str = "mptv-files"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_PRESIGN_EXPIRE_SECONDS: int = 600
    S3_USE_SSL: bool = False

    METRICS_ENABLED: bool = True

    @property
    def cors_origins(self) -> list[str]:
        raw = self.CORS_ORIGINS.strip()
        if not raw:
            return []
        if raw.startswith("["):
            parsed = json.loads(raw)
            return [str(item).strip() for item in parsed if str(item).strip()]
        return [part.strip() for part in raw.split(",") if part.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def production(self) -> bool:
        return self.APP_ENV == "prod"

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.production:
            if self.JWT_SECRET_KEY in {"dev-only-change-me", "", "change-this-secret-key-in-production"}:
                raise ValueError("JWT_SECRET_KEY must be explicitly configured in production")
            if "postgresql" not in self.DATABASE_URL:
                raise ValueError("DATABASE_URL must point to PostgreSQL in production")
            required = [self.S3_ENDPOINT_URL, self.S3_BUCKET, self.S3_ACCESS_KEY, self.S3_SECRET_KEY]
            if any(not value for value in required):
                raise ValueError("S3 credentials and endpoint must be configured in production")
            if not self.cors_origins:
                raise ValueError("CORS_ORIGINS must be configured in production")
        else:
            if len(self.JWT_SECRET_KEY) < 16:
                self.JWT_SECRET_KEY = secrets.token_hex(24)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
