from __future__ import annotations

from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, Index, UniqueConstraint, func
from database import Base

class CycleMember(Base):
    __tablename__ = "cycle_members"
    __table_args__ = (
        UniqueConstraint("cycle_id", "user_id", name="uc_cycle_user"),
        Index("ix_cycle_order", "cycle_id", "payout_order"),
    )
    id = Column(Integer, primary_key=True, index=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    payout_order = Column(Integer, nullable=False)
    received = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
