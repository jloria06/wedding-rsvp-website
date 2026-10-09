from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models import AdminRole, AdminStatus


class AdminAccountItem(BaseModel):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    role: AdminRole
    status: AdminStatus
    is_password_change_required: bool
    failed_login_attempts: int
    locked_until: datetime | None
    last_login_at: datetime | None
    created_at: datetime


class AdminAccountListResponse(BaseModel):
    success: bool = True
    administrators: list[AdminAccountItem]
    total: int


class AdminAccountCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100, pattern=r"^[A-Za-z0-9._-]+$")
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: AdminRole = AdminRole.ADMIN
    temporary_password: str = Field(min_length=12, max_length=128)


class AdminAccountUpdateRequest(BaseModel):
    email: EmailStr | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    role: AdminRole | None = None
    status: AdminStatus | None = None

    @model_validator(mode="after")
    def require_change(self) -> AdminAccountUpdateRequest:
        if not self.model_fields_set:
            raise ValueError("At least one administrator field must be provided.")
        return self


class AdminAccountPasswordResetRequest(BaseModel):
    temporary_password: str = Field(min_length=12, max_length=128)


class AdminAccountMutationResponse(BaseModel):
    success: bool = True
    message: str
    administrator: AdminAccountItem
