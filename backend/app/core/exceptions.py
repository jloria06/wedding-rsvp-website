from typing import Any


class ApplicationError(Exception):
    """Base exception for expected application errors."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
        error_code: str = "APPLICATION_ERROR",
        details: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details


class ResourceNotFoundError(ApplicationError):
    def __init__(
        self,
        message: str = "The requested resource was not found.",
        *,
        details: Any | None = None,
    ) -> None:
        super().__init__(
            message,
            status_code=404,
            error_code="RESOURCE_NOT_FOUND",
            details=details,
        )


class ConflictError(ApplicationError):
    def __init__(
        self,
        message: str = "The request conflicts with the current resource state.",
        *,
        details: Any | None = None,
    ) -> None:
        super().__init__(
            message,
            status_code=409,
            error_code="RESOURCE_CONFLICT",
            details=details,
        )


class AuthenticationError(ApplicationError):
    def __init__(
        self,
        message: str = "Authentication failed.",
        *,
        details: Any | None = None,
    ) -> None:
        super().__init__(
            message,
            status_code=401,
            error_code="AUTHENTICATION_FAILED",
            details=details,
        )


class AuthorizationError(ApplicationError):
    def __init__(
        self,
        message: str = "You are not authorized to perform this action.",
        *,
        details: Any | None = None,
    ) -> None:
        super().__init__(
            message,
            status_code=403,
            error_code="AUTHORIZATION_FAILED",
            details=details,
        )
