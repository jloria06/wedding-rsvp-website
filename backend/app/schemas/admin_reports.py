from pydantic import BaseModel


class ReportBreakdownItem(BaseModel):
    label: str
    value: int


class AdminReportSummaryResponse(BaseModel):
    success: bool = True
    total_invitations: int
    responded_invitations: int
    pending_invitations: int
    attending_invitations: int
    declined_invitations: int
    attending_people: int
    companions_attending: int
    ceremony_people: int
    reception_people: int
    dietary_requests: int
    response_rate: float
    assigned_reception_people: int
    unassigned_reception_people: int
    seating_completion_rate: float
    attendance_breakdown: list[ReportBreakdownItem]
    meal_breakdown: list[ReportBreakdownItem]
    age_breakdown: list[ReportBreakdownItem]
