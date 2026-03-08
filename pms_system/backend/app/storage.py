from __future__ import annotations

from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import BinaryIO
from uuid import uuid4

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from .errors import AppException
from .settings import Settings


class S3Storage:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            use_ssl=settings.S3_USE_SSL,
            config=Config(signature_version="s3v4"),
        )
        self.bucket = settings.S3_BUCKET

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "")
            if error_code in {"404", "NoSuchBucket"}:
                self.client.create_bucket(Bucket=self.bucket)
                return
            raise

    def upload(self, *, file_name: str, content: bytes, content_type: str | None) -> tuple[str, str]:
        object_key = f"attachments/{uuid4().hex}_{file_name}"
        try:
            self.client.upload_fileobj(
                Fileobj=BytesIO(content),
                Bucket=self.bucket,
                Key=object_key,
                ExtraArgs={"ContentType": content_type or "application/octet-stream"},
            )
            return self.bucket, object_key
        except (ClientError, BotoCoreError) as exc:
            raise AppException(
                status_code=503,
                code="storage_upload_failed",
                message="Failed to upload file",
                details=str(exc),
            ) from exc

    def delete(self, *, bucket: str, object_key: str) -> None:
        try:
            self.client.delete_object(Bucket=bucket, Key=object_key)
        except (ClientError, BotoCoreError) as exc:
            raise AppException(
                status_code=503,
                code="storage_delete_failed",
                message="Failed to delete file",
                details=str(exc),
            ) from exc

    def presign_download(self, *, bucket: str, object_key: str, file_name: str) -> tuple[str, datetime]:
        expires_in = self.settings.S3_PRESIGN_EXPIRE_SECONDS
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        try:
            url = self.client.generate_presigned_url(
                ClientMethod="get_object",
                Params={
                    "Bucket": bucket,
                    "Key": object_key,
                    "ResponseContentDisposition": f'attachment; filename="{file_name}"',
                },
                ExpiresIn=expires_in,
            )
            return url, expires_at
        except (ClientError, BotoCoreError) as exc:
            raise AppException(
                status_code=503,
                code="storage_presign_failed",
                message="Failed to create download URL",
                details=str(exc),
            ) from exc

    def ready(self) -> bool:
        try:
            self.client.head_bucket(Bucket=self.bucket)
            return True
        except Exception:
            return False
