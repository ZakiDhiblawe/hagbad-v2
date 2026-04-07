from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.group.models import Group, GroupPrivacy
from app.group_member.models import GroupMember, GroupMemberRole
from app.group_settings.models import GroupSettings, SettingsFrequency
from app.group_settings.schemas import (
    GroupSettingsCreate,
    GroupSettingsOut,
    GroupSettingsUpdate,
)
from app.user.models import User
from utility.security import get_current_user, get_db

router = APIRouter(prefix="/group-settings", tags=["group_settings"])


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


def is_group_member(db: Session, group_id: int, user_id: int) -> bool:
    return (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
        is not None
    )


def get_group_or_404(db: Session, group_id: int) -> Group:
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


def get_settings_or_404(db: Session, group_id: int) -> GroupSettings:
    s = db.query(GroupSettings).filter(GroupSettings.group_id == group_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Group settings not found")
    return s


def require_creator_or_admin(db: Session, group_id: int, user_id: int) -> None:
    if not (is_group_creator(db, group_id, user_id) or is_group_admin(db, group_id, user_id)):
        raise HTTPException(status_code=403, detail="Not allowed")


@router.post("/", response_model=GroupSettingsOut, status_code=status.HTTP_201_CREATED)
def create_settings(
    payload: GroupSettingsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupSettings:
    group = get_group_or_404(db, payload.group_id)
    require_creator_or_admin(db, group.id, current_user.id)

    existing = db.query(GroupSettings).filter(GroupSettings.group_id == group.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Settings already exist for this group")

    settings = GroupSettings(
        group_id=group.id,
        contribution_amount=payload.contribution_amount,
        frequency=payload.frequency,
        custom_days=payload.custom_days if payload.frequency == SettingsFrequency.custom_days else None,
        allow_late=payload.allow_late,
        late_penalty=payload.late_penalty if payload.allow_late else None,
        auto_start_cycle=payload.auto_start_cycle,
    )

    db.add(settings)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Settings already exist for this group")
    db.refresh(settings)
    return settings


@router.get("/{group_id}", response_model=GroupSettingsOut)
def get_settings(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupSettings:
    group = get_group_or_404(db, group_id)

    # Read policy (assumption): public groups readable by any authed user;
    # private groups require membership/creator/admin.
    if group.privacy == GroupPrivacy.private:
        if not (is_group_creator(db, group.id, current_user.id) or is_group_member(db, group.id, current_user.id)):
            raise HTTPException(status_code=403, detail="Not allowed")

    return get_settings_or_404(db, group.id)


@router.put("/{group_id}", response_model=GroupSettingsOut)
def update_settings(
    group_id: int,
    payload: GroupSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupSettings:
    group = get_group_or_404(db, group_id)
    require_creator_or_admin(db, group.id, current_user.id)

    s = get_settings_or_404(db, group.id)

    # Compute next values to validate cross-field rules
    new_frequency = payload.frequency or s.frequency
    new_custom_days = payload.custom_days if payload.custom_days is not None else s.custom_days

    new_allow_late = payload.allow_late if payload.allow_late is not None else s.allow_late
    new_late_penalty = payload.late_penalty if payload.late_penalty is not None else s.late_penalty

    if new_frequency == SettingsFrequency.custom_days and not new_custom_days:
        raise HTTPException(status_code=400, detail="custom_days is required when frequency=custom_days")
    if new_frequency != SettingsFrequency.custom_days:
        new_custom_days = None

    if not new_allow_late:
        new_late_penalty = None

    if payload.contribution_amount is not None:
        s.contribution_amount = payload.contribution_amount

    s.frequency = new_frequency
    s.custom_days = new_custom_days
    s.allow_late = new_allow_late
    s.late_penalty = new_late_penalty

    if payload.auto_start_cycle is not None:
        s.auto_start_cycle = payload.auto_start_cycle

    db.commit()
    db.refresh(s)
    return s


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_settings(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    group = get_group_or_404(db, group_id)
    require_creator_or_admin(db, group.id, current_user.id)

    s = get_settings_or_404(db, group.id)
    db.delete(s)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
