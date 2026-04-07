from __future__ import annotations

from enum import Enum

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SAEnum

from database import Base


class GroupPrivacy(str, Enum):
    public = "public"
    private = "private"


class GroupStatus(str, Enum):
    active = "active"
    closed = "closed"


class Group(Base):
    __tablename__ = "groups"

    __table_args__ = (
        UniqueConstraint("name", name="uq_groups_name"),
        Index("ix_groups_created_by", "created_by"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)

    privacy = Column(
        SAEnum(GroupPrivacy, name="group_privacy"),
        nullable=False,
        default=GroupPrivacy.public,
    )

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    status = Column(
        SAEnum(GroupStatus, name="group_status"),
        nullable=False,
        default=GroupStatus.active,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
