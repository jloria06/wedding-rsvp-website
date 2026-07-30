import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import api_router
from app.core import (
    configure_logging,
    get_settings,
    register_exception_handlers,
)
from app.database.session import engine

settings = get_settings()
configure_logging()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    logger.info(
        "Starting %s in %s environment.",
        settings.app_name,
        settings.app_env,
    )

    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    logger.info("Database startup check passed.")

    yield

    engine.dispose()
    logger.info("Application shutdown completed.")


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Local Wedding RSVP backend API.",
        debug=settings.debug,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(application)
    application.include_router(api_router)

    return application


app = create_application()
