from pydantic import BaseModel


class AdminDashboardStatisticsResponse(BaseModel):
    success: bool = True
    total_guests: int
    allocated_seats: int
    rsvp_responses: int
    attending: int
    declined: int
    pending: int
    adults: int | None = None
    children: int | None = None
