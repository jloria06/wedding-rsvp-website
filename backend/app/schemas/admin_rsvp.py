from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import AttendanceType, MealPreference, RSVPStatus
from app.schemas.rsvp import CompanionInput, CompanionResponse


class AdminRSVPListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    guest_id: int
    invitation_code: str
    guest_name: str
    household_name: str | None
    maximum_companions: int
    rsvp_id: int | None
    status: RSVPStatus
    attendance_type: AttendanceType | None
    companion_count: int
    meal_preference: MealPreference | None
    dietary_restrictions: str | None
    guest_message: str | None
    responded_at: datetime | None
    companions: list[CompanionResponse]


class AdminRSVPListResponse(BaseModel):
    success: bool = True
    rsvps: list[AdminRSVPListItem]
    total: int


class AdminRSVPUpsertRequest(BaseModel):
    status: RSVPStatus
    attendance_type: AttendanceType | None = None
    meal_preference: MealPreference | None = None
    dietary_restrictions: str | None = Field(default=None, max_length=500)
    guest_message: str | None = Field(default=None, max_length=2000)
    companions: list[CompanionInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_attendance_details(self) -> AdminRSVPUpsertRequest:
        if self.status == RSVPStatus.ATTENDING and self.attendance_type is None:
            raise ValueError("attendance_type is required when attending.")
        if self.status != RSVPStatus.ATTENDING:
            if self.attendance_type is not None:
                raise ValueError("attendance_type must be omitted unless attending.")
            if self.companions:
                raise ValueError("companions must be empty unless attending.")
        return self


class AdminRSVPMutationResponse(BaseModel):
    success: bool = True
    message: str
    rsvp: AdminRSVPListItem
