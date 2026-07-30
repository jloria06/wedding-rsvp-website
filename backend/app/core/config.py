from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIRECTORY / ".env"


class Settings(BaseSettings):
    app_name: str = Field(default="Wedding RSVP API", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=False, alias="DEBUG")

    host: str = Field(default="127.0.0.1", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    database_host: str = Field(alias="DATABASE_HOST")
    database_port: int = Field(default=3306, alias="DATABASE_PORT")
    database_name: str = Field(alias="DATABASE_NAME")
    database_user: str = Field(alias="DATABASE_USER")
    database_password: str = Field(alias="DATABASE_PASSWORD")

    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    refresh_secret_key: str = Field(alias="REFRESH_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=30,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    refresh_token_expire_days: int = Field(
        default=7,
        alias="REFRESH_TOKEN_EXPIRE_DAYS",
    )

    frontend_origins: str = Field(
        default="http://localhost:5173",
        alias="FRONTEND_ORIGINS",
    )

    rsvp_rate_limit: str = Field(
        default="10/minute",
        alias="RSVP_RATE_LIMIT",
    )
    guest_verify_rate_limit: str = Field(
        default="10/minute",
        alias="GUEST_VERIFY_RATE_LIMIT",
    )
    admin_login_rate_limit: str = Field(
        default="5/minute",
        alias="ADMIN_LOGIN_RATE_LIMIT",
    )

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_directory: Path = Field(alias="LOG_DIRECTORY")
    upload_directory: Path = Field(alias="UPLOAD_DIRECTORY")

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    @property
    def sqlalchemy_database_url(self):
        from sqlalchemy import URL

        return URL.create(
            drivername="mysql+pymysql",
            username=self.database_user,
            password=self.database_password,
            host=self.database_host,
            port=self.database_port,
            database=self.database_name,
            query={"charset": "utf8mb4"},
        )

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.frontend_origins.split(",")
            if origin.strip()
        ]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def is_staging(self) -> bool:
        return self.app_env.lower() == "staging"

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
