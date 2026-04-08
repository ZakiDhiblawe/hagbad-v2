from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class InviteCreate(BaseModel):
    group_id: int = Field(..., ge=1)
    expires_at: datetime | None = None


class InviteUse(BaseModel):
    code: str = Field(..., min_length=16, max_length=64)


class InviteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    code: str
    created_by: int
    expires_at: datetime | None
    used: bool
    created_at: datetime
