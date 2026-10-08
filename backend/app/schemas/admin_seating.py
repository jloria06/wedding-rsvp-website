from datetime import datetime

from pydantic import BaseModel, Field


class SeatingTableCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    capacity: int = Field(ge=1, le=1000)
    notes: str | None = Field(default=None, max_length=500)


class SeatingTableUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    capacity: int | None = Field(default=None, ge=1, le=1000)
    notes: str | None = Field(default=None, max_length=500)


class SeatAssignmentRequest(BaseModel):
    table_id: int = Field(gt=0)


class SeatingPartyItem(BaseModel):
    guest_id: int
    invitation_code: str
    guest_name: str
    household_name: str | None
    party_size: int
    companion_names: list[str]


class SeatingAssignmentItem(SeatingPartyItem):
    assignment_id: int
    assigned_at: datetime


class SeatingTableItem(BaseModel):
    id: int
    name: str
    capacity: int
    notes: str | None
    assigned_seats: int
    remaining_seats: int
    assignments: list[SeatingAssignmentItem]


class SeatingOverviewResponse(BaseModel):
    success: bool = True
    tables: list[SeatingTableItem]
    unassigned_parties: list[SeatingPartyItem]
    total_capacity: int
    assigned_seats: int
    remaining_seats: int


class SeatingMutationResponse(BaseModel):
    success: bool = True
    message: str
    seating: SeatingOverviewResponse
