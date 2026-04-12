from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.group.models import Group, GroupPrivacy, GroupStatus
from app.group_member.models import GroupMember, GroupMemberRole
from app.join_request.models import JoinRequest, JoinRequestStatus
from app.join_request.schemas import JoinRequestCreate, JoinRequestDecision, JoinRequestOut
from app.user.models import User
from utility.security import get_current_user, get_db

router = APIRouter(prefix="/join-requests", tags=["join_requests"])


def get_group_or_404(db: Session, group_id: int) -> Group:
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


def get_join_request_or_404(db: Session, request_id: int) -> JoinRequest:
    join_request = db.query(JoinRequest).filter(JoinRequest.id == request_id).first()
    if not join_request:
        raise HTTPException(status_code=404, detail="Join request not found")
    return join_request


def is_group_creator(group: Group, user_id: int) -> bool:
    return int(group.created_by) == int(user_id)


def is_group_admin(db: Session, group_id: int, user_id: int) -> bool:
    member = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.role == GroupMemberRole.admin,
        )
        .first()
    )
    return member is not None


def require_group_admin_or_creator(db: Session, group: Group, user_id: int) -> None:
    if is_group_creator(group, user_id):
        return

    if is_group_admin(db, group.id, user_id):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only group creator or admin can perform this action",
    )


@router.post("/", response_model=JoinRequestOut, status_code=status.HTTP_201_CREATED)
def create_join_request(
    payload: JoinRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JoinRequest:
    group = get_group_or_404(db, payload.group_id)

    if group.status != GroupStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group is not active",
        )

    if group.privacy != GroupPrivacy.private:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Join requests are only for private groups",
        )

    already_member = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == group.id,
            GroupMember.user_id == current_user.id,
        )
        .first()
    )
    if already_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this group",
        )

    existing_pending = (
        db.query(JoinRequest)
        .filter(
            JoinRequest.group_id == group.id,
            JoinRequest.user_id == current_user.id,
            JoinRequest.status == JoinRequestStatus.pending,
        )
        .first()
    )
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending join request for this group",
        )

    join_request = JoinRequest(
        group_id=group.id,
        user_id=current_user.id,
        status=JoinRequestStatus.pending,
    )

    db.add(join_request)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create join request",
        )

    db.refresh(join_request)
    return join_request


@router.get("/mine", response_model=list[JoinRequestOut])
def list_my_join_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[JoinRequest]:
    return (
        db.query(JoinRequest)
        .filter(JoinRequest.user_id == current_user.id)
        .order_by(JoinRequest.requested_at.desc())
        .all()
    )


@router.get("/group/{group_id}", response_model=list[JoinRequestOut])
def list_group_join_requests(
    group_id: int,
    status_filter: JoinRequestStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[JoinRequest]:
    group = get_group_or_404(db, group_id)
    require_group_admin_or_creator(db, group, current_user.id)

    query = db.query(JoinRequest).filter(JoinRequest.group_id == group.id)

    if status_filter is not None:
        query = query.filter(JoinRequest.status == status_filter)

    return query.order_by(JoinRequest.requested_at.desc()).all()


@router.get("/managed", response_model=list[JoinRequestOut])
def list_managed_join_requests(
    status_filter: JoinRequestStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[JoinRequest]:
    managed_group_ids = [
        group_id
        for (group_id,) in (
            db.query(Group.id)
            .outerjoin(
                GroupMember,
                (GroupMember.group_id == Group.id)
                & (GroupMember.user_id == current_user.id)
                & (GroupMember.role == GroupMemberRole.admin),
            )
            .filter(
                or_(
                    Group.created_by == current_user.id,
                    GroupMember.id.isnot(None),
                )
            )
            .distinct()
            .all()
        )
    ]

    if not managed_group_ids:
        return []

    query = db.query(JoinRequest).filter(JoinRequest.group_id.in_(managed_group_ids))

    if status_filter is not None:
        query = query.filter(JoinRequest.status == status_filter)

    return query.order_by(JoinRequest.requested_at.desc()).all()


@router.get("/{request_id}", response_model=JoinRequestOut)
def get_join_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JoinRequest:
    join_request = get_join_request_or_404(db, request_id)
    group = get_group_or_404(db, join_request.group_id)

    is_owner = int(join_request.user_id) == int(current_user.id)
    is_manager = is_group_creator(group, current_user.id) or is_group_admin(db, group.id, current_user.id)

    if not is_owner and not is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to view this join request",
        )

    return join_request


@router.post("/{request_id}/decision", response_model=JoinRequestOut)
def decide_join_request(
    request_id: int,
    payload: JoinRequestDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JoinRequest:
    join_request = get_join_request_or_404(db, request_id)
    group = get_group_or_404(db, join_request.group_id)

    require_group_admin_or_creator(db, group, current_user.id)

    if join_request.status != JoinRequestStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This join request has already been handled",
        )

    if payload.action == "reject":
        join_request.status = JoinRequestStatus.rejected
        join_request.handled_by = current_user.id
        db.commit()
        db.refresh(join_request)
        return join_request

    # approve
    if group.status != GroupStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group is not active",
        )

    existing_member = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == group.id,
            GroupMember.user_id == join_request.user_id,
        )
        .first()
    )
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this group",
        )

    new_member = GroupMember(
        group_id=group.id,
        user_id=join_request.user_id,
        role=GroupMemberRole.member,
    )
    db.add(new_member)

    join_request.status = JoinRequestStatus.approved
    join_request.handled_by = current_user.id

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not approve join request",
        )

    db.refresh(join_request)
    return join_request


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_join_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    join_request = get_join_request_or_404(db, request_id)

    if int(join_request.user_id) != int(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own join request",
        )

    if join_request.status != JoinRequestStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending requests can be cancelled",
        )

    db.delete(join_request)
    db.commit()
    return None
