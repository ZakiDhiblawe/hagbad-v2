from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.group.models import Group, GroupStatus
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
