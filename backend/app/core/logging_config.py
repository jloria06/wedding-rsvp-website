import logging
import logging.config
from pathlib import Path
from typing import Any

from app.core.config import get_settings

settings = get_settings()


class SensitiveDataFilter(logging.Filter):
    """Remove sensitive values from log messages."""

    def __init__(self) -> None:
        super().__init__()

        self.sensitive_values = [
            settings.database_password,
            settings.jwt_secret_key,
            settings.refresh_secret_key,
        ]

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()

        for sensitive_value in self.sensitive_values:
            if sensitive_value:
                message = message.replace(
                    sensitive_value,
                    "[REDACTED]",
                )

        record.msg = message
        record.args = ()

        return True


def build_logging_configuration() -> dict[str, Any]:
    log_directory = Path(settings.log_directory)
    log_directory.mkdir(parents=True, exist_ok=True)

    application_log = log_directory / "application.log"
    error_log = log_directory / "error.log"

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "filters": {
            "sensitive_data": {
                "()": SensitiveDataFilter,
            },
        },
        "formatters": {
            "standard": {
                "format": ("%(asctime)s | %(levelname)s | %(name)s | %(message)s"),
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": settings.log_level.upper(),
                "formatter": "standard",
                "filters": ["sensitive_data"],
            },
            "application_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": settings.log_level.upper(),
                "formatter": "standard",
                "filters": ["sensitive_data"],
                "filename": str(application_log),
                "maxBytes": 5_242_880,
                "backupCount": 5,
                "encoding": "utf-8",
            },
            "error_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "ERROR",
                "formatter": "standard",
                "filters": ["sensitive_data"],
                "filename": str(error_log),
                "maxBytes": 5_242_880,
                "backupCount": 5,
                "encoding": "utf-8",
            },
        },
        "root": {
            "level": settings.log_level.upper(),
            "handlers": [
                "console",
                "application_file",
                "error_file",
            ],
        },
        "loggers": {
            "uvicorn": {
                "level": "INFO",
                "handlers": [
                    "console",
                    "application_file",
                    "error_file",
                ],
                "propagate": False,
            },
            "uvicorn.access": {
                "level": "INFO",
                "handlers": [
                    "console",
                    "application_file",
                ],
                "propagate": False,
            },
            "sqlalchemy.engine": {
                "level": "WARNING",
                "handlers": [
                    "console",
                    "application_file",
                    "error_file",
                ],
                "propagate": False,
            },
        },
    }


def configure_logging() -> None:
    logging.config.dictConfig(build_logging_configuration())
