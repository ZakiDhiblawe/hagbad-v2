from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.payment.models import PaymentStatus


class PaymentCreate(BaseModel):
    cycle_id: int = Field(..., ge=1)
    cycle_member_id: int = Field(..., ge=1)
    due_date: date
    amount_due: Decimal | None = Field(default=None, gt=0)
    amount_paid: Decimal = Field(default=Decimal("0"), ge=0)
    paid_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_amounts(self):
        if self.amount_due is not None and self.amount_paid > self.amount_due:
            raise ValueError("amount_paid cannot be greater than amount_due")
        if self.amount_paid == 0:
            self.paid_at = None
        return self


class PaymentUpdate(BaseModel):
    due_date: date | None = None
    amount_due: Decimal | None = Field(default=None, gt=0)
    amount_paid: Decimal | None = Field(default=None, ge=0)
    paid_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cycle_id: int
    cycle_member_id: int
    created_by: int
    due_date: date
    amount_due: Decimal
    amount_paid: Decimal
    status: PaymentStatus
    paid_at: datetime | None
    notes: str | None
    created_at: datetime


class PaymentSummary(BaseModel):
    cycle_id: int
    total_payments: int
    due_count: int
    paid_count: int
    late_count: int
    total_amount_due: Decimal
    total_amount_paid: Decimal
    outstanding_amount: Decimal
