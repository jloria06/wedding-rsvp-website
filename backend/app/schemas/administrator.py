from pydantic import BaseModel, Field


class AdministratorLoginRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=100,
    )

    password: str = Field(
        min_length=8,
        max_length=128,
    )


class AdministratorLoginResponse(BaseModel):
    success: bool = True
    message: str
    administrator_id: int
    username: str
    role: str
    is_password_change_required: bool
    access_token: str
    token_type: str = "bearer"


class AdministratorPasswordChangeRequest(BaseModel):
    current_password: str = Field(
        min_length=8,
        max_length=128,
    )
    new_password: str = Field(
        min_length=12,
        max_length=128,
    )


class AdministratorPasswordChangeResponse(BaseModel):
    success: bool = True
    message: str


class AdministratorProfileResponse(BaseModel):
    success: bool = True
    administrator_id: int
    username: str
    email: str
    first_name: str
    last_name: str
    role: str
    status: str
    is_password_change_required: bool
