from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.cycle_member.models import CycleMember
from app.cycle_member.schemas import CycleMemberCreate, CycleMemberOut, CycleMemberUpdate
from app.cycle.models import Cycle
from app.group.models import Group
from app.group_member.models import GroupMember, GroupMemberRole
from app.payment.models import Payment
from app.payout.models import Payout
from app.user.models import User
from utility.security import get_db, get_current_user

router = APIRouter(prefix="/cycle-members", tags=["cycle_members"])

def is_cycle_creator(db: Session, cycle_id: int, user_id: int) -> bool:
    c = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    return bool(c and c.created_by == user_id)

def is_group_admin(db: Session, cycle_id: int, user_id: int) -> bool:
    c = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not c: return False
    gm = db.query(GroupMember).filter(
        GroupMember.group_id == c.group_id,
        GroupMember.user_id == user_id,
        GroupMember.role == GroupMemberRole.admin
    ).first()
    return bool(gm)

def is_cycle_participant(db: Session, cycle_id: int, user_id: int) -> bool:
    if is_cycle_creator(db, cycle_id, user_id): return True
    member = db.query(CycleMember).filter(
        CycleMember.cycle_id == cycle_id,
        CycleMember.user_id == user_id
    ).first()
    return bool(member)

def is_group_member_for_cycle(db: Session, cycle_id: int, user_id: int) -> bool:
    cycle = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not cycle:
        return False
    group = db.query(Group).filter(Group.id == cycle.group_id).first()
    if not group:
        return False
    if group.created_by == user_id:
        return True
    return bool(db.query(GroupMember).filter(
        GroupMember.group_id == cycle.group_id,
        GroupMember.user_id == user_id
    ).first())

def can_view_cycle_members(db: Session, cycle_id: int, user_id: int) -> bool:
    return is_cycle_participant(db, cycle_id, user_id) or is_group_admin(db, cycle_id, user_id)

def payout_order_taken(db: Session, cycle_id: int, payout_order: int, exclude_member_id: int | None = None) -> bool:
    query = db.query(CycleMember).filter(
        CycleMember.cycle_id == cycle_id,
        CycleMember.payout_order == payout_order,
    )
    if exclude_member_id is not None:
        query = query.filter(CycleMember.id != exclude_member_id)
    return query.first() is not None

def cycle_has_payout_records(db: Session, cycle_id: int) -> bool:
    return db.query(Payout).filter(Payout.cycle_id == cycle_id).first() is not None

def require_admin_or_creator(db: Session, cycle_id: int, user_id: int):
    if not (is_cycle_creator(db, cycle_id, user_id) or is_group_admin(db, cycle_id, user_id)):
        raise HTTPException(status_code=403, detail="Not allowed")

@router.post("/", response_model=CycleMemberOut, status_code=status.HTTP_201_CREATED)
def add_member(payload: CycleMemberCreate,
               db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)) -> CycleMember:
    require_admin_or_creator(db, payload.cycle_id, current_user.id)
    if not is_group_member_for_cycle(db, payload.cycle_id, payload.user_id):
        raise HTTPException(status_code=400, detail="User must already belong to the group before joining a cycle")
    if payload.payout_order is None:
        maxm = db.query(CycleMember).filter(
            CycleMember.cycle_id == payload.cycle_id
        ).order_by(CycleMember.payout_order.desc()).first()
        payload.payout_order = maxm.payout_order + 1 if maxm else 1
    if payout_order_taken(db, payload.cycle_id, payload.payout_order):
        raise HTTPException(status_code=400, detail="Payout order already assigned in this cycle")
    member = CycleMember(
        cycle_id=payload.cycle_id,
        user_id=payload.user_id,
        payout_order=payload.payout_order
    )
    db.add(member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Member or order conflict")
    db.refresh(member)
    return member

@router.get("/", response_model=list[CycleMemberOut])
def list_members(cycle_id: int = Query(..., ge=1),
                 page: int = Query(1, ge=1),
                 size: int = Query(20, ge=1, le=100),
                 order: Optional[int] = None,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)) -> list[CycleMember]:
    if not can_view_cycle_members(db, cycle_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not allowed")
    query = db.query(CycleMember).filter(CycleMember.cycle_id == cycle_id)
    if order is not None:
        query = query.filter(CycleMember.payout_order == order)
    offset = (page - 1) * size
    return query.order_by(CycleMember.payout_order).offset(offset).limit(size).all()

@router.get("/{member_id}", response_model=CycleMemberOut)
def get_member(member_id: int,
               db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)) -> CycleMember:
    m = db.query(CycleMember).filter(CycleMember.id == member_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Not found")
    if not can_view_cycle_members(db, m.cycle_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not allowed")
    return m

@router.put("/{member_id}", response_model=CycleMemberOut)
def update_member(member_id: int,
                  payload: CycleMemberUpdate,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)) -> CycleMember:
    m = db.query(CycleMember).filter(CycleMember.id == member_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Not found")
    if payload.payout_order is not None:
        require_admin_or_creator(db, m.cycle_id, current_user.id)
        if cycle_has_payout_records(db, m.cycle_id):
            raise HTTPException(status_code=400, detail="Cannot change payout order after payout records have been created")
        if payout_order_taken(db, m.cycle_id, payload.payout_order, exclude_member_id=m.id):
            raise HTTPException(status_code=400, detail="Payout order already assigned in this cycle")
        m.payout_order = payload.payout_order
    if payload.received is not None:
        if m.user_id != current_user.id and not is_cycle_creator(db, m.cycle_id, current_user.id) and not is_group_admin(db, m.cycle_id, current_user.id):
            raise HTTPException(status_code=403, detail="Not allowed")
        m.received = payload.received
    db.commit(); db.refresh(m)
    return m

@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(member_id: int,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    m = db.query(CycleMember).filter(CycleMember.id == member_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Not found")
    require_admin_or_creator(db, m.cycle_id, current_user.id)
    if cycle_has_payout_records(db, m.cycle_id):
        raise HTTPException(status_code=400, detail="Cannot remove a cycle member after payout records have been created")
    if db.query(Payment).filter(Payment.cycle_member_id == m.id).first():
        raise HTTPException(status_code=400, detail="Cannot remove a cycle member after payments have been recorded")
    db.delete(m); db.commit()
    return {}
