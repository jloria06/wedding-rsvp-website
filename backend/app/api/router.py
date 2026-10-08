from fastapi import APIRouter

from app.api.admin import (
    admin_auth_router,
    admin_dashboard_router,
    admin_guest_router,
    admin_rsvp_router,
)
from app.api.public import (
    guest_router,
    health_router,
    rsvp_router,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
api_router.include_router(guest_router)
api_router.include_router(rsvp_router)

api_router.include_router(
    admin_auth_router,
    prefix="/admin",
)

api_router.include_router(
    admin_dashboard_router,
    prefix="/admin",
)

api_router.include_router(
    admin_guest_router,
    prefix="/admin",
)

api_router.include_router(
    admin_rsvp_router,
    prefix="/admin",
)
