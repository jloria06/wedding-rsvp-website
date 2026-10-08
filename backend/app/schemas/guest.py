from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import AgeGroup, GuestStatus


class GuestVerificationRequest(BaseModel):
    invitation_code: str = Field(
        min_length=4,
        max_length=64,
        examples=["JP-JOYCE-0001"],
    )


class GuestSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invitation_code: str
    first_name: str
    middle_name: str | None
    last_name: str
    email: EmailStr | None
    phone_number: str | None
    household_name: str | None
    maximum_companions: int
    age_group: AgeGroup
    is_primary_guest: bool
    status: GuestStatus
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


class GuestVerificationResponse(BaseModel):
    success: bool = True
    guest: GuestSummaryResponse
    has_existing_rsvp: bool
