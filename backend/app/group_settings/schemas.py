from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.group_settings.models import SettingsFrequency


class GroupSettingsCreate(BaseModel):
    group_id: int = Field(..., ge=1)
    contribution_amount: Decimal = Field(..., gt=0)
    frequency: SettingsFrequency
    custom_days: int | None = Field(default=None, ge=1)

    allow_late: bool = False
    late_penalty: Decimal | None = Field(default=None, ge=0)

    auto_start_cycle: bool = False

    @model_validator(mode="after")
    def validate_rules(self):
        if self.frequency == SettingsFrequency.custom_days:
            if not self.custom_days:
                raise ValueError("custom_days is required when frequency=custom_days")
        else:
            self.custom_days = None

        if not self.allow_late:
            self.late_penalty = None

        return self


class GroupSettingsUpdate(BaseModel):
    contribution_amount: Decimal | None = Field(default=None, gt=0)
    frequency: SettingsFrequency | None = None
    custom_days: int | None = Field(default=None, ge=1)

    allow_late: bool | None = None
    late_penalty: Decimal | None = Field(default=None, ge=0)

    auto_start_cycle: bool | None = None


class GroupSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    contribution_amount: Decimal
    frequency: SettingsFrequency
    custom_days: int | None
    allow_late: bool
    late_penalty: Decimal | None
    auto_start_cycle: bool
    created_at: datetime
