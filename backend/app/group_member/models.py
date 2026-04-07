from __future__ import annotations

from enum import Enum

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SAEnum

from database import Base


class GroupMemberRole(str, Enum):
    admin = "admin"
    moderator = "moderator"
    member = "member"


class GroupMember(Base):
    __tablename__ = "group_members"

    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_members_group_user"),
        Index("ix_group_members_group_user", "group_id", "user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    role = Column(
        SAEnum(GroupMemberRole, name="group_member_role"),
        nullable=False,
        default=GroupMemberRole.member,
    )

    joined_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
