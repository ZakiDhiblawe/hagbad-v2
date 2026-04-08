from __future__ import annotations

from datetime import datetime, timezone

import secrets
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.group.models import Group, GroupStatus
from app.group_member.models import GroupMember, GroupMemberRole
from app.group_member.schemas import GroupMemberOut
from app.invite.models import Invite
from app.invite.schemas import InviteCreate, InviteOut, InviteUse
from app.user.models import User
from utility.security import get_current_user, get_db

router = APIRouter(prefix="/invites", tags=["invites"])


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def is_group_creator(db: Session, group_id: int, user_id: int) -> bool:
    return (
        db.query(Group)
        .filter(Group.id == group_id, Group.created_by == user_id)
        .first()
        is not None
    )


def is_group_admin(db: Session, group_id: int, user_id: int) -> bool:
    return (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.role == GroupMemberRole.admin,
        )
        .first()
        is not None
    )


def require_creator_or_admin(db: Session, group_id: int, user_id: int) -> None:
    if not (is_group_creator(db, group_id, user_id) or is_group_admin(db, group_id, user_id)):
        raise HTTPException(status_code=403, detail="Not allowed")


def get_group_or_404(db: Session, group_id: int) -> Group:
    g = db.query(Group).filter(Group.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    return g


@router.post("/", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
def create_invite(
    payload: InviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Invite:
    group = get_group_or_404(db, payload.group_id)
    require_creator_or_admin(db, group.id, current_user.id)

    if payload.expires_at is not None:
        exp = _ensure_aware(payload.expires_at)
        if exp <= _now_utc():
            raise HTTPException(status_code=400, detail="expires_at must be in the future")
    else:
        exp = None

    # Secure random code (32 hex chars for token_hex(16)). citeturn0search3
    for _ in range(5):
        code = secrets.token_hex(16)
        invite = Invite(group_id=group.id, created_by=current_user.id, code=code, expires_at=exp, used=False)
        db.add(invite)
        try:
            db.commit()
            db.refresh(invite)
            return invite
        except IntegrityError:
            db.rollback()
            continue

    raise HTTPException(status_code=400, detail="Could not generate unique invite code")


@router.get("/{group_id}", response_model=list[InviteOut])
def list_invites(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Invite]:
    group = get_group_or_404(db, group_id)
    require_creator_or_admin(db, group.id, current_user.id)

    return (
        db.query(Invite)
        .filter(Invite.group_id == group.id)
        .order_by(Invite.created_at.desc())
        .all()
    )


@router.post("/redeem", response_model=GroupMemberOut)
def redeem_invite(
    payload: InviteUse,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupMember:
    # Lock invite row to reduce race conditions on used flag (PostgreSQL).
    invite = (
        db.query(Invite)
        .filter(Invite.code == payload.code)
        .with_for_update()
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.used:
        raise HTTPException(status_code=400, detail="Invite already used")

    if invite.expires_at is not None and _ensure_aware(invite.expires_at) <= _now_utc():
        raise HTTPException(status_code=400, detail="Invite expired")

    group = get_group_or_404(db, invite.group_id)
    if group.status == GroupStatus.closed:
        raise HTTPException(status_code=400, detail="Group is closed")

    # Already member?
    existing = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group.id, GroupMember.user_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You are already a member of this group")

    member = GroupMember(group_id=group.id, user_id=current_user.id, role=GroupMemberRole.member)
    db.add(member)
    invite.used = True

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Already a member or invite conflict")

    db.refresh(member)
    return member


@router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    invite = db.query(Invite).filter(Invite.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    group = get_group_or_404(db, invite.group_id)
    require_creator_or_admin(db, group.id, current_user.id)

    db.delete(invite)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
