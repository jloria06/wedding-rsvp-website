from fastapi import APIRouter

from app.api.admin import (
    admin_audit_router,
    admin_auth_router,
    admin_content_router,
    admin_dashboard_router,
    admin_guest_router,
    admin_reports_router,
    admin_rsvp_router,
    admin_seating_router,
)
from app.api.public import (
    guest_router,
    health_router,
    rsvp_router,
    wedding_content_router,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
api_router.include_router(guest_router)
api_router.include_router(rsvp_router)
api_router.include_router(wedding_content_router)

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

api_router.include_router(
    admin_content_router,
    prefix="/admin",
)

api_router.include_router(
    admin_seating_router,
    prefix="/admin",
)

api_router.include_router(
    admin_reports_router,
    prefix="/admin",
)

api_router.include_router(
    admin_audit_router,
    prefix="/admin",
)
