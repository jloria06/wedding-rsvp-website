from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import (
    AttendanceType,
    MealPreference,
    RSVPStatus,
)


class CompanionInput(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    meal_preference: MealPreference | None = None
    dietary_restrictions: str | None = Field(
        default=None,
        max_length=500,
    )


class RSVPSubmissionRequest(BaseModel):
    invitation_code: str = Field(min_length=4, max_length=64)
    status: RSVPStatus
    attendance_type: AttendanceType | None = None
    meal_preference: MealPreference | None = None
    dietary_restrictions: str | None = Field(
        default=None,
        max_length=500,
    )
    guest_message: str | None = Field(
        default=None,
        max_length=2000,
    )
    companions: list[CompanionInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_attendance_details(self) -> RSVPSubmissionRequest:
        if self.status == RSVPStatus.ATTENDING:
            if self.attendance_type is None:
                raise ValueError("attendance_type is required when attending.")

        if self.status == RSVPStatus.NOT_ATTENDING:
            if self.attendance_type is not None:
                raise ValueError("attendance_type must be omitted when not attending.")

            if self.companions:
                raise ValueError("companions must be empty when not attending.")

        return self


class CompanionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    middle_name: str | None
    last_name: str
    meal_preference: MealPreference | None
    dietary_restrictions: str | None
    created_at: datetime
    updated_at: datetime

    @property
    def full_name(self) -> str:
        name_parts = [
            self.first_name,
            self.middle_name,
            self.last_name,
        ]

        return " ".join(part.strip() for part in name_parts if part and part.strip())


class RSVPResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    guest_id: int
    status: RSVPStatus
    attendance_type: AttendanceType | None
    companion_count: int
    meal_preference: MealPreference | None
    dietary_restrictions: str | None
    guest_message: str | None
    responded_at: datetime | None
    created_at: datetime
    updated_at: datetime
    companions: list[CompanionResponse]


class RSVPSubmissionResponse(BaseModel):
    success: bool = True
    message: str
    rsvp: RSVPResponse
