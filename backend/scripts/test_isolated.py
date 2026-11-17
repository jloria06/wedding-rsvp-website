"""Run pytest without connecting to the configured MySQL database.

Usage from backend/: .venv/Scripts/python.exe scripts/test_isolated.py -q
MySQL health-query functions are emulated; this is not a MySQL compatibility test.
"""

import logging
import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    with TemporaryDirectory(prefix="wedding-planner-tests-") as temporary:
        os.environ.update(
            {
                "DEBUG": "false",
                "APP_ENV": "development",
                "DATABASE_HOST": "127.0.0.1",
                "DATABASE_NAME": "isolated_test",
                "DATABASE_USER": "isolated_test",
                "DATABASE_PASSWORD": "unused-test-password",
                "DATABASE_SSL_CA": "",
                "JWT_SECRET_KEY": "isolated-test-jwt-secret-not-for-production-0001",
                "REFRESH_SECRET_KEY": (
                    "isolated-test-refresh-secret-not-for-production-0002"
                ),
                "LOG_DIRECTORY": str(Path(temporary) / "logs"),
                "UPLOAD_DIRECTORY": str(Path(temporary) / "uploads"),
            }
        )
        engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(engine, "connect")
        def sqlite_health_functions(connection, _):
            connection.create_function("DATABASE", 0, lambda: "isolated_test")
            connection.create_function(
                "CURRENT_USER", 0, lambda: "isolated_test@localhost"
            )
            connection.create_function("VERSION", 0, lambda: "SQLite isolated test")

        # app/__init__.py eagerly initializes the app. Replace its engine before import.
        def isolated_engine(url, *args, **kwargs):
            if str(url).startswith("mysql"):
                return engine
            return create_engine(url, *args, **kwargs)

        with patch("sqlalchemy.create_engine", side_effect=isolated_engine):
            import app  # noqa: F401
        from app.database.base import Base

        Base.metadata.create_all(engine)
        try:
            return pytest.main(sys.argv[1:] or ["-q"])
        finally:
            engine.dispose()
            logging.shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
