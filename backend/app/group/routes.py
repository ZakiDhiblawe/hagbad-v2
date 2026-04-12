from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.group.models import Group, GroupStatus
from app.group_member.models import GroupMember
from app.group_settings.models import GroupSettings
from app.invite.models import Invite
from app.join_request.models import JoinRequest
from app.cycle.models import Cycle
from app.cycle_member.models import CycleMember
from app.payment.models import Payment
from app.payout.models import Payout
from app.group.schemas import GroupCreate, GroupOut, GroupUpdate
from app.user.models import User
from utility.security import get_current_user, get_db

router = APIRouter(prefix="/groups", tags=["groups"])


def _get_group_or_404(db: Session, group_id: int) -> Group:
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


def _require_creator(group: Group, current_user: User) -> None:
    # Extend later: allow group_members role=admin
    if group.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")


@router.post("/", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Group:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    # Pre-check for nicer error message
    if db.query(Group).filter(Group.name == name).first():
        raise HTTPException(status_code=400, detail="Group name already exists")

    group = Group(
        name=name,
        description=payload.description,
        privacy=payload.privacy,
        created_by=current_user.id,
    )

    db.add(group)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Group name already exists")
    db.refresh(group)
    return group


@router.get("/", response_model=list[GroupOut])
def list_groups(
    mine: bool = Query(False),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Group]:
    q = db.query(Group)
    if mine:
        q = q.filter(Group.created_by == current_user.id)

    offset = (page - 1) * size
    return (
        q.order_by(Group.created_at.desc())
        .offset(offset)
        .limit(size)
        .all()
    )


@router.get("/{group_id}", response_model=GroupOut)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Group:
    return _get_group_or_404(db, group_id)


@router.put("/{group_id}", response_model=GroupOut)
def update_group(
    group_id: int,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Group:
    group = _get_group_or_404(db, group_id)
    _require_creator(group, current_user)

    if payload.name is not None:
        new_name = payload.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        group.name = new_name

    if payload.description is not None:
        group.description = payload.description

    if payload.privacy is not None:
        group.privacy = payload.privacy

    if payload.status is not None:
        group.status = payload.status

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Group name already exists")
    db.refresh(group)
    return group


@router.post("/{group_id}/close", response_model=GroupOut)
def close_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Group:
    group = _get_group_or_404(db, group_id)
    _require_creator(group, current_user)

    if group.status == GroupStatus.closed:
        raise HTTPException(status_code=400, detail="Group already closed")

    group.status = GroupStatus.closed
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    group = _get_group_or_404(db, group_id)
    _require_creator(group, current_user)

    cycle_ids = [
        cycle_id
        for (cycle_id,) in db.query(Cycle.id).filter(Cycle.group_id == group.id).all()
    ]

    cycle_member_ids: list[int] = []
    if cycle_ids:
        cycle_member_ids = [
            member_id
            for (member_id,) in (
                db.query(CycleMember.id)
                .filter(CycleMember.cycle_id.in_(cycle_ids))
                .all()
            )
        ]

    if cycle_member_ids:
        db.query(Payment).filter(Payment.cycle_member_id.in_(cycle_member_ids)).delete(
            synchronize_session=False
        )
        db.query(Payout).filter(Payout.cycle_member_id.in_(cycle_member_ids)).delete(
            synchronize_session=False
        )

    if cycle_ids:
        db.query(Payment).filter(Payment.cycle_id.in_(cycle_ids)).delete(
            synchronize_session=False
        )
        db.query(Payout).filter(Payout.cycle_id.in_(cycle_ids)).delete(
            synchronize_session=False
        )
        db.query(CycleMember).filter(CycleMember.cycle_id.in_(cycle_ids)).delete(
            synchronize_session=False
        )
        db.query(Cycle).filter(Cycle.id.in_(cycle_ids)).delete(synchronize_session=False)

    db.query(GroupSettings).filter(GroupSettings.group_id == group.id).delete(
        synchronize_session=False
    )
    db.query(GroupMember).filter(GroupMember.group_id == group.id).delete(
        synchronize_session=False
    )
    db.query(Invite).filter(Invite.group_id == group.id).delete(synchronize_session=False)
    db.query(JoinRequest).filter(JoinRequest.group_id == group.id).delete(
        synchronize_session=False
    )
    db.delete(group)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
