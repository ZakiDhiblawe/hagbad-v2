from __future__ import annotations

from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SAEnum

from database import Base


class SettingsFrequency(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    custom_days = "custom_days"


class GroupSettings(Base):
    __tablename__ = "group_settings"

    __table_args__ = (
        UniqueConstraint("group_id", name="uq_group_settings_group_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)

    contribution_amount = Column(Numeric(12, 2), nullable=False)

    frequency = Column(
        SAEnum(SettingsFrequency, name="settings_frequency"),
        nullable=False,
    )

    custom_days = Column(Integer, nullable=True)

    allow_late = Column(Boolean, nullable=False, default=False)
    late_penalty = Column(Numeric(12, 2), nullable=True)

    auto_start_cycle = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
