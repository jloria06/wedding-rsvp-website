from pathlib import Path
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIRECTORY / ".env"

load_dotenv(ENV_FILE)


def get_required_environment_variable(name: str) -> str:
    value = os.getenv(name)

    if value is None or not value.strip():
        raise ValueError(f"Required environment variable is missing: {name}")

    return value.strip()


def main() -> int:
    try:
        database_url = URL.create(
            drivername="mysql+pymysql",
            username=get_required_environment_variable("DATABASE_USER"),
            password=get_required_environment_variable("DATABASE_PASSWORD"),
            host=get_required_environment_variable("DATABASE_HOST"),
            port=int(get_required_environment_variable("DATABASE_PORT")),
            database=get_required_environment_variable("DATABASE_NAME"),
        )

        engine = create_engine(
            database_url,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=False,
        )

        with engine.connect() as connection:
            result = connection.execute(text("""
                    SELECT
                        DATABASE() AS active_database,
                        CURRENT_USER() AS authenticated_account,
                        VERSION() AS mysql_version
                    """)).mappings().one()

            print("[PASSED] SQLAlchemy connected to MySQL.")
            print(f"Database: {result['active_database']}")
            print(f"Account: {result['authenticated_account']}")
            print(f"MySQL version: {result['mysql_version']}")

        engine.dispose()
        return 0

    except ValueError as exc:
        print("[FAILED] Backend environment configuration is incomplete.")
        print(str(exc))
        return 1

    except SQLAlchemyError as exc:
        print("[FAILED] SQLAlchemy could not connect to MySQL.")
        print(f"Error type: {type(exc).__name__}")

        original_error = getattr(exc, "orig", None)

        if original_error is not None:
            error_code = (
                original_error.args[0]
                if getattr(original_error, "args", None)
                else "Unknown"
            )
            print(f"MySQL error code: {error_code}")

        return 1


if __name__ == "__main__":
    sys.exit(main())
