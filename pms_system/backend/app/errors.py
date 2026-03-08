from __future__ import annotations

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .schemas import ErrorEnvelope, ErrorPayload


class AppException(Exception):
    def __init__(
        self,
        *,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        code: str = "bad_request",
        message: str = "Request failed",
        details: dict | list | str | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def error_response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details: dict | list | str | None = None,
) -> JSONResponse:
    envelope = ErrorEnvelope(
        error=ErrorPayload(code=code, message=message, details=details),
        request_id=_request_id(request),
    )
    return JSONResponse(status_code=status_code, content=envelope.model_dump())


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return error_response(
        request,
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        details=exc.details,
    )


async def http_exception_handler(request: Request, exc: HTTPException | StarletteHTTPException) -> JSONResponse:
    detail = exc.detail
    code = "http_error"
    message = str(detail) if isinstance(detail, str) else "Request failed"
    details = detail if not isinstance(detail, str) else None
    return error_response(
        request,
        status_code=exc.status_code,
        code=code,
        message=message,
        details=details,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return error_response(
        request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="validation_error",
        message="Validation failed",
        details=exc.errors(),
    )


async def integrity_exception_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    return error_response(
        request,
        status_code=status.HTTP_409_CONFLICT,
        code="integrity_error",
        message="Resource conflict",
        details=str(exc.orig),
    )


async def unexpected_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return error_response(
        request,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="internal_error",
        message="Unexpected server error",
    )
