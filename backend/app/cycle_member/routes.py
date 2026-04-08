from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.cycle_member.models import CycleMember
from app.cycle_member.schemas import CycleMemberCreate, CycleMemberOut, CycleMemberUpdate
from app.cycle.models import Cycle
from app.group.models import Group
from app.group_member.models import GroupMember, GroupMemberRole
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

def require_admin_or_creator(db: Session, cycle_id: int, user_id: int):
    if not (is_cycle_creator(db, cycle_id, user_id) or is_group_admin(db, cycle_id, user_id)):
        raise HTTPException(status_code=403, detail="Not allowed")

@router.post("/", response_model=CycleMemberOut, status_code=status.HTTP_201_CREATED)
def add_member(payload: CycleMemberCreate,
               db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)) -> CycleMember:
    require_admin_or_creator(db, payload.cycle_id, current_user.id)
    if payload.payout_order is None:
        maxm = db.query(CycleMember).filter(
            CycleMember.cycle_id == payload.cycle_id
        ).order_by(CycleMember.payout_order.desc()).first()
        payload.payout_order = maxm.payout_order + 1 if maxm else 1
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
    if not is_cycle_participant(db, cycle_id, current_user.id):
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
    if not is_cycle_participant(db, m.cycle_id, current_user.id):
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
    db.delete(m); db.commit()
    return {}
