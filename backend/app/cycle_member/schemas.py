from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class CycleMemberCreate(BaseModel):
    cycle_id: int = Field(..., ge=1)
    user_id: int = Field(..., ge=1)
    payout_order: Optional[int] = Field(default=None, ge=1)

class CycleMemberUpdate(BaseModel):
    payout_order: Optional[int] = Field(default=None, ge=1)
    received: Optional[bool] = None

class CycleMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cycle_id: int
    user_id: int
    payout_order: int
    received: bool
    created_at: datetime
