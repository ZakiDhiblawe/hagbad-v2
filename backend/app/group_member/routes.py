from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.group.models import Group
from app.group_member.models import GroupMember, GroupMemberRole
from app.group_member.schemas import GroupMemberCreate, GroupMemberOut, GroupMemberUpdate
from app.user.models import User
from utility.security import get_current_user, get_db

router = APIRouter(prefix="/group-members", tags=["group_members"])


def is_group_creator(db: Session, group_id: int, user_id: int) -> bool:
    created_by = db.query(Group.created_by).filter(Group.id == group_id).scalar()
    if created_by is None:
        return False
    return int(created_by) == int(user_id)


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


def get_member_or_404(db: Session, member_id: int) -> GroupMember:
    member = db.query(GroupMember).filter(GroupMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Group member not found")
    return member


def serialize_member(
    db: Session,
    member: GroupMember,
    *,
    full_name: str | None = None,
    profile_image: str | None = None,
) -> GroupMemberOut:
    if full_name is None and profile_image is None:
        user = (
            db.query(User.full_name, User.profile_image)
            .filter(User.id == member.user_id)
            .first()
        )
        if user:
            full_name = user.full_name
            profile_image = user.profile_image

    return GroupMemberOut(
        id=member.id,
        group_id=member.group_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        full_name=full_name or f"User #{member.user_id}",
        profile_image=profile_image,
    )


def promote_successor_if_needed(db: Session, group: Group, member: GroupMember) -> None:
    if member.role != GroupMemberRole.admin:
        return

    other_admin_count = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == group.id,
            GroupMember.role == GroupMemberRole.admin,
            GroupMember.id != member.id,
        )
        .count()
    )
    if other_admin_count > 0:
        return

    successor = None
    for role in (GroupMemberRole.moderator, GroupMemberRole.member):
        successor = (
            db.query(GroupMember)
            .filter(
                GroupMember.group_id == group.id,
                GroupMember.role == role,
                GroupMember.id != member.id,
            )
            .order_by(GroupMember.joined_at.asc(), GroupMember.id.asc())
            .first()
        )
        if successor:
            break

    if successor is None:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove the last admin because there is no other member to promote",
        )

    successor.role = GroupMemberRole.admin


@router.post("/", response_model=GroupMemberOut, status_code=status.HTTP_201_CREATED)
def add_member(
    payload: GroupMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupMemberOut:
    group = get_group_or_404(db, payload.group_id)

    # Permission: creator OR existing admin
    if not (group.created_by == current_user.id or is_group_admin(db, group.id, current_user.id)):
        raise HTTPException(status_code=403, detail="Not allowed")

    # Ensure target user exists
    target_user = db.query(User).filter(User.id == payload.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Already a member?
    if is_group_member(db, group.id, payload.user_id):
        raise HTTPException(status_code=400, detail="User is already a member")

    member = GroupMember(
        group_id=group.id,
        user_id=payload.user_id,
        role=payload.role or GroupMemberRole.member,
    )

    db.add(member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="User is already a member")
    db.refresh(member)
    return serialize_member(
        db,
        member,
        full_name=target_user.full_name,
        profile_image=target_user.profile_image,
    )


@router.get("/", response_model=list[GroupMemberOut])
def list_members(
    group_id: int = Query(..., ge=1),
    role: GroupMemberRole | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GroupMemberOut]:
    group = get_group_or_404(db, group_id)

    # Access: creator OR any current member (admin included)
    if not (group.created_by == current_user.id or is_group_member(db, group.id, current_user.id)):
        raise HTTPException(status_code=403, detail="Not allowed")

    q = (
        db.query(GroupMember, User.full_name, User.profile_image)
        .join(User, User.id == GroupMember.user_id)
        .filter(GroupMember.group_id == group.id)
    )
    if role is not None:
        q = q.filter(GroupMember.role == role)

    offset = (page - 1) * size
    rows = (
        q.order_by(GroupMember.joined_at.asc(), GroupMember.id.asc())
        .offset(offset)
        .limit(size)
        .all()
    )
    return [
        serialize_member(
            db,
            member,
            full_name=full_name,
            profile_image=profile_image,
        )
        for member, full_name, profile_image in rows
    ]


@router.put("/{member_id}", response_model=GroupMemberOut)
def update_member_role(
    member_id: int,
    payload: GroupMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupMemberOut:
    member = get_member_or_404(db, member_id)
    group = get_group_or_404(db, member.group_id)

    # Permission: creator OR admin
    if not (group.created_by == current_user.id or is_group_admin(db, group.id, current_user.id)):
        raise HTTPException(status_code=403, detail="Not allowed")

    if payload.role is None:
        raise HTTPException(status_code=400, detail="Role is required")

    if member.user_id == group.created_by and payload.role != GroupMemberRole.admin:
        raise HTTPException(status_code=400, detail="Creator must remain an admin")

    # Cannot demote last admin
    if member.role == GroupMemberRole.admin and payload.role != GroupMemberRole.admin:
        other_admin_count = (
            db.query(GroupMember)
            .filter(
                GroupMember.group_id == group.id,
                GroupMember.role == GroupMemberRole.admin,
                GroupMember.id != member.id,
            )
            .count()
        )
        if other_admin_count == 0:
            raise HTTPException(status_code=400, detail="Cannot demote the last admin")

    member.role = payload.role
    db.commit()
    db.refresh(member)
    return serialize_member(db, member)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    member = get_member_or_404(db, member_id)
    group = get_group_or_404(db, member.group_id)

    # Permission: creator OR admin
    if not (group.created_by == current_user.id or is_group_admin(db, group.id, current_user.id)):
        raise HTTPException(status_code=403, detail="Not allowed")

    # Creator cannot be removed
    if member.user_id == group.created_by:
        raise HTTPException(status_code=400, detail="Creator cannot be removed")

    promote_successor_if_needed(db, group, member)
    db.delete(member)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_group(
    group_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    group = get_group_or_404(db, group_id)
    member = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group.id, GroupMember.user_id == current_user.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="You are not a member of this group")

    if member.user_id == group.created_by:
        raise HTTPException(
            status_code=400,
            detail="Group creator cannot leave until ownership transfer is supported",
        )

    promote_successor_if_needed(db, group, member)
    db.delete(member)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
