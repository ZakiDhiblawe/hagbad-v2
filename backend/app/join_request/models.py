from __future__ import annotations

from enum import Enum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Index, func
from sqlalchemy import Enum as SAEnum

from database import Base


class JoinRequestStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class JoinRequest(Base):
    __tablename__ = "join_requests"

    id = Column(Integer, primary_key=True, index=True)

    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    status = Column(
        SAEnum(JoinRequestStatus, name="join_request_status"),
        nullable=False,
        default=JoinRequestStatus.pending,
        server_default=JoinRequestStatus.pending.value,
    )

    requested_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    handled_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        Index("ix_join_requests_group_id", "group_id"),
        Index("ix_join_requests_user_id", "user_id"),
        Index("ix_join_requests_status", "status"),
    )