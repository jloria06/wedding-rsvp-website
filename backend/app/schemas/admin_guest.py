from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import AgeGroup, GuestStatus, RSVPStatus


class AdminGuestListItem(BaseModel):
    id: int
    invitation_code: str
    full_name: str
    first_name: str
    middle_name: str | None
    last_name: str
    email: str | None
    phone_number: str | None
    household_name: str | None
    maximum_companions: int
    age_group: AgeGroup
    is_primary_guest: bool
    status: GuestStatus
    rsvp_status: RSVPStatus | None
    created_at: datetime


class AdminGuestListResponse(BaseModel):
    success: bool = True
    guests: list[AdminGuestListItem]
    total: int


class AdminGuestCreateRequest(BaseModel):
    invitation_code: str = Field(
        min_length=4,
        max_length=64,
    )
    first_name: str = Field(
        min_length=1,
        max_length=100,
    )
    middle_name: str | None = Field(
        default=None,
        max_length=100,
    )
    last_name: str = Field(
        min_length=1,
        max_length=100,
    )
    email: EmailStr | None = None
    phone_number: str | None = Field(
        default=None,
        max_length=50,
    )
    household_name: str | None = Field(
        default=None,
        max_length=150,
    )
    maximum_companions: int = Field(
        default=0,
        ge=0,
        le=20,
    )
    age_group: AgeGroup = AgeGroup.ADULT
    is_primary_guest: bool = True


class AdminGuestCreateResponse(BaseModel):
    success: bool = True
    message: str
    guest: AdminGuestListItem


class AdminGuestUpdateRequest(BaseModel):
    first_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    middle_name: str | None = Field(
        default=None,
        max_length=100,
    )
    last_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    email: EmailStr | None = None
    phone_number: str | None = Field(
        default=None,
        max_length=50,
    )
    household_name: str | None = Field(
        default=None,
        max_length=150,
    )
    maximum_companions: int | None = Field(
        default=None,
        ge=0,
        le=20,
    )
    age_group: AgeGroup | None = None
    is_primary_guest: bool | None = None
    status: GuestStatus | None = None


class AdminGuestUpdateResponse(BaseModel):
    success: bool = True
    message: str
    guest: AdminGuestListItem


class AdminGuestDeleteResponse(BaseModel):
    success: bool = True
    message: str
    guest_id: int
