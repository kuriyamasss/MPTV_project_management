from __future__ import annotations

import asyncio
import json
import logging
import time
from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from .errors import error_response
from .metrics import REQUEST_COUNT, REQUEST_LATENCY
from .settings import Settings

logger = logging.getLogger("mptv.http")


def configure_logging() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    root.handlers = [handler]


class RequestContextMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, settings: Settings) -> None:
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request_id = request.headers.get("x-request-id", uuid4().hex)
        request.state.request_id = request_id
        started = time.perf_counter()

        try:
            response = await asyncio.wait_for(
                call_next(request), timeout=self.settings.REQUEST_TIMEOUT_SECONDS
            )
        except TimeoutError:
            response = error_response(
                request,
                status_code=504,
                code="request_timeout",
                message="Request timed out",
            )
        except asyncio.TimeoutError:
            response = error_response(
                request,
                status_code=504,
                code="request_timeout",
                message="Request timed out",
            )

        duration = time.perf_counter() - started
        status_code = str(response.status_code)
        path = request.url.path

        REQUEST_COUNT.labels(request.method, path, status_code).inc()
        REQUEST_LATENCY.labels(request.method, path).observe(duration)

        response.headers["x-request-id"] = request_id
        response.headers["x-content-type-options"] = "nosniff"
        response.headers["x-frame-options"] = "DENY"
        response.headers["referrer-policy"] = "strict-origin-when-cross-origin"
        response.headers["content-security-policy"] = "default-src 'self'"

        log_record = {
            "type": "http_access",
            "request_id": request_id,
            "method": request.method,
            "path": path,
            "status_code": response.status_code,
            "duration_ms": round(duration * 1000, 2),
            "user_id": getattr(request.state, "user_id", None),
            "client_ip": request.client.host if request.client else None,
        }
        logger.info(json.dumps(log_record, ensure_ascii=True))
        return response
