from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.cycle.models import CycleFrequency, CycleStatus


class CycleCreate(BaseModel):
    group_id: int = Field(..., ge=1)
    start_date: date
    frequency: CycleFrequency
    custom_days: int | None = Field(default=None, ge=1)
    auto_start: bool = False

    @model_validator(mode="after")
    def validate_custom_days(self):
        if self.frequency == CycleFrequency.custom_days and not self.custom_days:
            raise ValueError("custom_days is required when frequency=custom_days")
        if self.frequency != CycleFrequency.custom_days:
            self.custom_days = None
        return self


class CycleUpdate(BaseModel):
    status: CycleStatus | None = None
    end_date: date | None = None
    frequency: CycleFrequency | None = None
    custom_days: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_update_custom_days(self):
        if self.frequency == CycleFrequency.custom_days and not self.custom_days:
            raise ValueError("custom_days is required when frequency=custom_days")
        if self.frequency and self.frequency != CycleFrequency.custom_days:
            self.custom_days = None
        return self


class CycleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    created_by: int
    start_date: date
    end_date: date | None
    frequency: CycleFrequency
    custom_days: int | None
    status: CycleStatus
    created_at: datetime
