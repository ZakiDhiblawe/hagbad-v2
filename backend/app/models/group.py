from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum

class GroupPrivacy(str, enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"

class GroupStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    SUSPENDED = "suspended"

class ContributionFrequency(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"

class Group(Base):
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    
    # Settings
    privacy = Column(Enum(GroupPrivacy), default=GroupPrivacy.PUBLIC)
    contribution_amount = Column(Float, nullable=False)
    frequency = Column(Enum(ContributionFrequency), default=ContributionFrequency.MONTHLY)
    custom_days = Column(Integer, nullable=True)
    allow_late = Column(Boolean, default=False)
    late_penalty = Column(Float, default=0)
    auto_start_cycle = Column(Boolean, default=False)
    
    # Status
    status = Column(Enum(GroupStatus), default=GroupStatus.ACTIVE)
    
    # Relations
    created_by = Column(Integer, ForeignKey("users.id"))
    creator = relationship("User", back_populates="groups_created", foreign_keys=[created_by])
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    members = relationship("GroupMember", back_populates="group")
    cycles = relationship("Cycle", back_populates="group")
    join_requests = relationship("JoinRequest", back_populates="group")
