from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.group_member.models import GroupMemberRole


class GroupMemberCreate(BaseModel):
    group_id: int = Field(..., ge=1)
    user_id: int = Field(..., ge=1)
    role: GroupMemberRole | None = GroupMemberRole.member


class GroupMemberUpdate(BaseModel):
    role: GroupMemberRole | None = None


class GroupMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    user_id: int
    role: GroupMemberRole
    joined_at: datetime
    full_name: str | None = None
    profile_image: str | None = None
