import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.core.exceptions import ApplicationError

logger = logging.getLogger(__name__)
settings = get_settings()


def build_error_response(
    *,
    error_code: str,
    message: str,
    details: Any | None = None,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "success": False,
        "error": {
            "code": error_code,
            "message": message,
        },
    }

    if details is not None:
        response["error"]["details"] = details

    return response


async def application_error_handler(
    request: Request,
    exception: ApplicationError,
) -> JSONResponse:
    logger.warning(
        "Application error on %s %s: %s",
        request.method,
        request.url.path,
        exception.error_code,
    )

    return JSONResponse(
        status_code=exception.status_code,
        content=build_error_response(
            error_code=exception.error_code,
            message=exception.message,
            details=exception.details,
        ),
    )


async def http_exception_handler(
    request: Request,
    exception: StarletteHTTPException,
) -> JSONResponse:
    logger.warning(
        "HTTP error on %s %s: %s",
        request.method,
        request.url.path,
        exception.status_code,
    )

    message = (
        exception.detail
        if isinstance(exception.detail, str)
        else "The request could not be completed."
    )

    return JSONResponse(
        status_code=exception.status_code,
        headers=exception.headers,
        content=build_error_response(
            error_code=f"HTTP_{exception.status_code}",
            message=message,
        ),
    )


async def validation_error_handler(
    request: Request,
    exception: RequestValidationError,
) -> JSONResponse:
    logger.info(
        "Request validation failed on %s %s",
        request.method,
        request.url.path,
    )

    validation_details = [
        {
            "field": ".".join(str(location) for location in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exception.errors()
    ]

    return JSONResponse(
        status_code=422,
        content=build_error_response(
            error_code="VALIDATION_ERROR",
            message="The request contains invalid data.",
            details=validation_details,
        ),
    )


async def database_error_handler(
    request: Request,
    exception: SQLAlchemyError,
) -> JSONResponse:
    logger.exception(
        "Database error on %s %s",
        request.method,
        request.url.path,
    )

    return JSONResponse(
        status_code=503,
        content=build_error_response(
            error_code="DATABASE_UNAVAILABLE",
            message="The database service is temporarily unavailable.",
        ),
    )


async def unexpected_error_handler(
    request: Request,
    exception: Exception,
) -> JSONResponse:
    logger.exception(
        "Unexpected error on %s %s",
        request.method,
        request.url.path,
    )

    details = None

    if settings.debug and settings.is_development:
        details = {
            "exception_type": type(exception).__name__,
        }

    return JSONResponse(
        status_code=500,
        content=build_error_response(
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred.",
            details=details,
        ),
    )


def register_exception_handlers(application: FastAPI) -> None:
    application.add_exception_handler(
        ApplicationError,
        application_error_handler,
    )
    application.add_exception_handler(
        StarletteHTTPException,
        http_exception_handler,
    )
    application.add_exception_handler(
        RequestValidationError,
        validation_error_handler,
    )
    application.add_exception_handler(
        SQLAlchemyError,
        database_error_handler,
    )
    application.add_exception_handler(
        Exception,
        unexpected_error_handler,
    )
