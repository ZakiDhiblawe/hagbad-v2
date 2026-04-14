from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.user.models import UserStatus


class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    phone: str | None = Field(default=None, max_length=30)

    @field_validator("password")
    @classmethod
    def password_must_fit_bcrypt_limit(cls, v: str) -> str:
        # bcrypt accepts up to 72 BYTES, not 72 characters. citeturn1search1turn1search4
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes (bcrypt limit).")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str | None = None
    profile_image: str | None = None
    status: UserStatus
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPasswordUpdate(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_must_fit_bcrypt_limit(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes (bcrypt limit).")
        return v
