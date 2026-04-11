from __future__ import annotations

from enum import Enum

from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, Text, UniqueConstraint, func
from sqlalchemy import Enum as SAEnum

from database import Base


class PaymentStatus(str, Enum):
    due = "due"
    paid = "paid"
    late = "late"


class Payment(Base):
    __tablename__ = "payments"

    __table_args__ = (
        UniqueConstraint("cycle_member_id", "due_date", name="uq_payments_cycle_member_due_date"),
        Index("ix_payments_cycle_id_status", "cycle_id", "status"),
        Index("ix_payments_cycle_member_due_date", "cycle_member_id", "due_date"),
    )

    id = Column(Integer, primary_key=True, index=True)

    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False)
    cycle_member_id = Column(Integer, ForeignKey("cycle_members.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    due_date = Column(Date, nullable=False)

    amount_due = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")

    status = Column(
        SAEnum(PaymentStatus, name="payment_status"),
        nullable=False,
        default=PaymentStatus.due,
        server_default=PaymentStatus.due.value,
    )

    paid_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
