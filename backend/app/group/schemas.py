from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.group.models import GroupPrivacy, GroupStatus


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    privacy: GroupPrivacy | None = Field(default=GroupPrivacy.public)
    visible: bool = True


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    privacy: GroupPrivacy | None = None
    status: GroupStatus | None = None
    visible: bool | None = None


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    visible: bool
    group_image: str | None = None
    cover_image: str | None = None
    privacy: GroupPrivacy
    created_by: int
    status: GroupStatus
    created_at: datetime
