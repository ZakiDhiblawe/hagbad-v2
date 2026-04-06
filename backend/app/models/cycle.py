from sqlalchemy import Column, Integer, ForeignKey, DateTime, Date, Enum, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum

class CycleStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Cycle(Base):
    __tablename__ = "cycles"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"))
    created_by = Column(Integer, ForeignKey("users.id"))
    
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    status = Column(Enum(CycleStatus), default=CycleStatus.PENDING)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    group = relationship("Group", back_populates="cycles")
    creator = relationship("User")
    cycle_members = relationship("CycleMember", back_populates="cycle")
    payments = relationship("Payment", back_populates="cycle")
    payouts = relationship("Payout", back_populates="cycle")
