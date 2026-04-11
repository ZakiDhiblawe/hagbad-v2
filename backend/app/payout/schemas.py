from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.payout.models import PayoutStatus


class PayoutCreate(BaseModel):
    cycle_id: int = Field(..., ge=1)
    cycle_member_id: int = Field(..., ge=1)
    amount: Decimal = Field(..., gt=0)
    notes: str | None = Field(default=None, max_length=2000)


class PayoutUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    notes: str | None = Field(default=None, max_length=2000)


class PayoutDecision(BaseModel):
    notes: str | None = Field(default=None, max_length=2000)


class PayoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cycle_id: int
    cycle_member_id: int
    created_by: int
    approved_by: int | None
    amount: Decimal
    status: PayoutStatus
    notes: str | None
    created_at: datetime
    approved_at: datetime | None
    paid_at: datetime | None


class PayoutSummary(BaseModel):
    cycle_id: int
    total_payouts: int
    pending_count: int
    approved_count: int
    rejected_count: int
    paid_count: int
    total_amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
