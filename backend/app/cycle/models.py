from __future__ import annotations

from enum import Enum

from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, func
from sqlalchemy import Enum as SAEnum

from database import Base


class CycleFrequency(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    custom_days = "custom_days"


class CycleStatus(str, Enum):
    pending = "pending"
    active = "active"
    paused = "paused"
    completed = "completed"


class Cycle(Base):
    __tablename__ = "cycles"

    __table_args__ = (
        Index("ix_cycles_group_id", "group_id"),
        Index("ix_cycles_created_by", "created_by"),
    )

    id = Column(Integer, primary_key=True, index=True)

    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)

    frequency = Column(
        SAEnum(CycleFrequency, name="cycle_frequency"),
        nullable=False,
    )

    # optional, used only when frequency=custom_days (fallback to group_settings.custom_days)
    custom_days = Column(Integer, nullable=True)

    status = Column(
        SAEnum(CycleStatus, name="cycle_status"),
        nullable=False,
        default=CycleStatus.pending,
        server_default=CycleStatus.pending.value,
    )

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
