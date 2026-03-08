from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

TEST_DB_PATH = Path(__file__).resolve().parent / "test_smoke.db"

os.environ["APP_ENV"] = "dev"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-please-change"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["S3_ENDPOINT_URL"] = "http://localhost:9000"
os.environ["S3_BUCKET"] = "test-bucket"
os.environ["S3_ACCESS_KEY"] = "test-access-key"
os.environ["S3_SECRET_KEY"] = "test-secret-key"
os.environ["S3_REGION"] = "us-east-1"
os.environ["S3_PRESIGN_EXPIRE_SECONDS"] = "600"

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
import app.main as app_main  # noqa: E402


class FakeStorage:
    def __init__(self) -> None:
        self.bucket = "test-bucket"
        self.objects: dict[str, bytes] = {}

    def ensure_bucket(self) -> None:
        return None

    def upload(
        self, *, file_name: str, content: bytes, content_type: str | None
    ) -> tuple[str, str]:
        object_key = f"attachments/{uuid4().hex}_{file_name}"
        self.objects[object_key] = content
        return self.bucket, object_key

    def delete(self, *, bucket: str, object_key: str) -> None:
        self.objects.pop(object_key, None)

    def presign_download(
        self, *, bucket: str, object_key: str, file_name: str
    ) -> tuple[str, datetime]:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        return f"https://files.example/{bucket}/{object_key}?name={file_name}", expires_at

    def ready(self) -> bool:
        return True


@pytest.fixture(autouse=True)
def reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


@pytest.fixture
def client() -> TestClient:
    app_main.storage = FakeStorage()
    with TestClient(app) as test_client:
        yield test_client
