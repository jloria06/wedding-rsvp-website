from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

connect_args = {}

if settings.database_ssl_ca:
    connect_args["ssl"] = {
        "ca": settings.database_ssl_ca,
    }

engine = create_engine(
    settings.sqlalchemy_database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.debug,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


def get_database_session() -> Generator[Session]:
    database_session = SessionLocal()

    try:
        yield database_session
    finally:
        database_session.close()
