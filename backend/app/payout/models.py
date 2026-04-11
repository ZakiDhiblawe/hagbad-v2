from __future__ import annotations

from enum import Enum

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, Text, UniqueConstraint, func
from sqlalchemy import Enum as SAEnum

from database import Base


class PayoutStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    paid = "paid"


class Payout(Base):
    __tablename__ = "payouts"

    __table_args__ = (
        UniqueConstraint("cycle_member_id", name="uq_payouts_cycle_member"),
        Index("ix_payouts_cycle_id_status", "cycle_id", "status"),
        Index("ix_payouts_cycle_member_id", "cycle_member_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False)
    cycle_member_id = Column(Integer, ForeignKey("cycle_members.id"), nullable=False)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(
        SAEnum(PayoutStatus, name="payout_status"),
        nullable=False,
        default=PayoutStatus.pending,
        server_default=PayoutStatus.pending.value,
    )

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
