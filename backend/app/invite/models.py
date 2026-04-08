from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)

from database import Base


class Invite(Base):
    __tablename__ = "invites"

    __table_args__ = (
        UniqueConstraint("code", name="uq_invites_code"),
        Index("ix_invites_group_id", "group_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    code = Column(String(64), nullable=False)

    expires_at = Column(DateTime(timezone=True), nullable=True)

    used = Column(Boolean, nullable=False, default=False, server_default="false")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
