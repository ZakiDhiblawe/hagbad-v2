from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.join_request.models import JoinRequestStatus


class JoinRequestCreate(BaseModel):
    group_id: int = Field(..., ge=1)


class JoinRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    user_id: int
    status: JoinRequestStatus
    requested_at: datetime
    handled_by: int | None = None


class JoinRequestDecision(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")


class JoinRequestListQuery(BaseModel):
    status: JoinRequestStatus | None = None