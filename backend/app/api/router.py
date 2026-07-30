from fastapi import APIRouter

from app.api.public import (
    guest_router,
    health_router,
    rsvp_router,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
api_router.include_router(guest_router)
api_router.include_router(rsvp_router)
