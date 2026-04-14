from __future__ import annotations

from enum import Enum

from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy import Enum as SAEnum

from database import Base


class UserStatus(str, Enum):
    active = "active"
    banned = "banned"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)

    # unique=True creates a UNIQUE constraint on this column
    email = Column(String(255), unique=True, index=True, nullable=False)

    phone = Column(String(30), nullable=True)

    profile_image = Column(String(255), nullable=True)

    # stores the hashed password
    password = Column(String(255), nullable=False)

    status = Column(
        SAEnum(UserStatus, name="user_status"),
        nullable=False,
        default=UserStatus.active,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
