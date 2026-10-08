from app.api.admin.auth import router as admin_auth_router
from app.api.admin.dashboard import router as admin_dashboard_router
from app.api.admin.guests import router as admin_guest_router
from app.api.admin.rsvps import router as admin_rsvp_router
from app.api.admin.seating import router as admin_seating_router
from app.api.admin.content import router as admin_content_router

__all__ = [
    "admin_auth_router",
    "admin_dashboard_router",
    "admin_guest_router",
    "admin_rsvp_router",
    "admin_seating_router",
    "admin_content_router",
]
