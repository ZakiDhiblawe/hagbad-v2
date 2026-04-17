from __future__ import annotations

from pathlib import Path
from typing import Final

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.cycle.models import Cycle
from app.cycle_member.models import CycleMember
from app.group.models import Group, GroupPrivacy, GroupStatus
from app.group.schemas import GroupOut
from app.group_member.models import GroupMember, GroupMemberRole
from app.group_settings.models import GroupSettings
from app.invite.models import Invite
from app.join_request.models import JoinRequest
from app.payment.models import Payment
from app.payout.models import Payout
from app.user.models import User
from app.group_member.schemas import GroupMemberOut
from utility.security import get_current_user, get_db

router = APIRouter(prefix="/groups", tags=["groups"])

BACKEND_DIR: Final[Path] = Path(__file__).resolve().parents[2]
GROUP_PROFILE_DIR: Final[Path] = BACKEND_DIR / "files" / "groups" / "profile"
GROUP_COVER_DIR: Final[Path] = BACKEND_DIR / "files" / "groups" / "cover"
GROUP_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
GROUP_COVER_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_EXTENSIONS: Final[set[str]] = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_GROUP_IMAGE_BYTES: Final[int] = 5 * 1024 * 1024


def _get_group_or_404(db: Session, group_id: int) -> Group:
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


def _is_group_member(db: Session, group_id: int, user_id: int) -> bool:
    return (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
        is not None
    )


def _get_group_membership(db: Session, group_id: int, user_id: int) -> GroupMember | None:
    return (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
    )


def _can_access_group(db: Session, group: Group, current_user: User) -> bool:
    if group.created_by == current_user.id:
        return True
    if _is_group_member(db, group.id, current_user.id):
        return True
    return group.privacy == GroupPrivacy.public and bool(group.visible)


def _require_access(db: Session, group: Group, current_user: User) -> None:
    if not _can_access_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not allowed")


def _require_creator(group: Group, current_user: User) -> None:
    if group.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")


def _parse_privacy(value: str | None, *, required: bool) -> GroupPrivacy | None:
    if value is None:
        return GroupPrivacy.public if required else None

    raw = value.strip().lower()
    if not raw:
        return GroupPrivacy.public if required else None

    try:
        return GroupPrivacy(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Privacy must be public or private") from exc


def _parse_status(value: str | None) -> GroupStatus | None:
    if value is None:
        return None

    raw = value.strip().lower()
    if not raw:
        return None

    try:
        return GroupStatus(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Status must be active or closed") from exc


def _parse_member_role(value: str | None) -> GroupMemberRole | None:
    if value is None:
        return None

    raw = value.strip().lower()
    if not raw or raw == "all":
        return None

    try:
        return GroupMemberRole(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Role must be admin, moderator, or member",
        ) from exc


def _normalize_image_extension(upload: UploadFile) -> str:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix == ".jpeg":
        suffix = ".jpg"

    if not suffix:
        content_type = (upload.content_type or "").lower()
        if content_type == "image/jpeg":
            suffix = ".jpg"
        elif content_type == "image/png":
            suffix = ".png"
        elif content_type == "image/webp":
            suffix = ".webp"
        elif content_type == "image/gif":
            suffix = ".gif"

    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group image must be JPG, PNG, WEBP, or GIF",
        )

    return suffix


def _delete_group_media(path_value: str | None) -> None:
    if not path_value:
        return

    allowed_prefixes = ("/files/groups/profile/", "/files/groups/cover/")
    if not path_value.startswith(allowed_prefixes):
        return

    target = BACKEND_DIR / path_value.lstrip("/")
    if target.is_file():
        target.unlink()


async def _save_group_media(
    group_id: int,
    upload: UploadFile,
    media_kind: str,
    existing_path: str | None,
) -> str:
    suffix = _normalize_image_extension(upload)
    folder = GROUP_PROFILE_DIR if media_kind == "profile" else GROUP_COVER_DIR
    destination = folder / f"{group_id}{suffix}"
    data = await upload.read()

    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded group image is empty",
        )

    if len(data) > MAX_GROUP_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group image must be 5 MB or smaller",
        )

    public_prefix = "/files/groups/profile" if media_kind == "profile" else "/files/groups/cover"
    new_path = f"{public_prefix}/{destination.name}"

    if existing_path and existing_path != new_path:
        _delete_group_media(existing_path)

    destination.write_bytes(data)
    await upload.close()
    return new_path


@router.post("/", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    name: str = Form(...),
    description: str | None = Form(default=None),
    privacy: str | None = Form(default=GroupPrivacy.public.value),
    visible: bool = Form(default=True),
    group_image: UploadFile | None = File(default=None),
    cover_image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Group:
    clean_name = name.strip()
    if len(clean_name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")

    if db.query(Group).filter(Group.name == clean_name).first():
        raise HTTPException(status_code=400, detail="Group name already exists")

    group = Group(
        name=clean_name,
        description=(description or "").strip() or None,
        privacy=_parse_privacy(privacy, required=True) or GroupPrivacy.public,
        visible=bool(visible),
        created_by=current_user.id,
    )

    saved_paths: list[str] = []
    db.add(group)
    try:
        db.flush()

        creator_membership = GroupMember(
            group_id=group.id,
            user_id=current_user.id,
            role=GroupMemberRole.admin,
        )
        db.add(creator_membership)

        if group_image is not None and group_image.filename:
            group.group_image = await _save_group_media(group.id, group_image, "profile", None)
            saved_paths.append(group.group_image)

        if cover_image is not None and cover_image.filename:
            group.cover_image = await _save_group_media(group.id, cover_image, "cover", None)
            saved_paths.append(group.cover_image)

        db.commit()
    except IntegrityError:
        db.rollback()
        for path in saved_paths:
            _delete_group_media(path)
        raise HTTPException(status_code=400, detail="Group name already exists")
    except HTTPException:
        db.rollback()
        for path in saved_paths:
            _delete_group_media(path)
        raise

    db.refresh(group)
    return group


@router.get("/", response_model=list[GroupOut])
def list_groups(
    mine: bool = Query(False),
    explore: bool = Query(False),
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    managed: bool = Query(False),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Group]:
    if mine and explore:
        raise HTTPException(status_code=400, detail="Use either mine or explore, not both")

    parsed_role = _parse_member_role(role)
    if parsed_role is not None and not mine:
        raise HTTPException(status_code=400, detail="Role filter is only available for my groups")
    if managed and not mine:
        raise HTTPException(status_code=400, detail="Managed filter is only available for my groups")

    search_value = (search or "").strip()

    q = db.query(Group)
    member_group_ids = db.query(GroupMember.group_id).filter(
        GroupMember.user_id == current_user.id
    )
    role_group_ids = None
    if parsed_role is not None:
        role_group_ids = db.query(GroupMember.group_id).filter(
            GroupMember.user_id == current_user.id,
            GroupMember.role == parsed_role,
        )

    if mine:
        managed_group_ids = db.query(GroupMember.group_id).filter(
            GroupMember.user_id == current_user.id,
            GroupMember.role.in_([GroupMemberRole.admin, GroupMemberRole.moderator]),
        )

        if managed:
            q = q.filter(
                or_(
                    Group.created_by == current_user.id,
                    Group.id.in_(managed_group_ids),
                )
            )
        elif parsed_role == GroupMemberRole.admin:
            q = q.filter(
                or_(
                    Group.created_by == current_user.id,
                    Group.id.in_(role_group_ids),
                )
            )
        elif parsed_role is not None:
            q = q.filter(Group.id.in_(role_group_ids))
        else:
            q = q.filter(
                or_(
                    Group.created_by == current_user.id,
                    Group.id.in_(member_group_ids),
                )
            )
    elif explore:
        q = q.filter(
            Group.visible.is_(True),
            Group.created_by != current_user.id,
            ~Group.id.in_(member_group_ids),
        )
    else:
        q = q.filter(
            or_(
                Group.created_by == current_user.id,
                Group.id.in_(member_group_ids),
                and_(Group.privacy == GroupPrivacy.public, Group.visible.is_(True)),
            )
        )

    if search_value:
        q = q.filter(Group.name.ilike(f"%{search_value}%"))

    offset = (page - 1) * size
    return q.order_by(Group.created_at.desc()).offset(offset).limit(size).all()


@router.get("/{group_id}", response_model=GroupOut)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Group:
    group = _get_group_or_404(db, group_id)
    _require_access(db, group, current_user)
    return group


@router.put("/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: int,
    name: str | None = Form(default=None),
    description: str | None = Form(default=None),
    privacy: str | None = Form(default=None),
    visible: bool | None = Form(default=None),
    status_value: str | None = Form(default=None, alias="status"),
    group_image: UploadFile | None = File(default=None),
    cover_image: UploadFile | None = File(default=None),
    remove_group_image: bool = Form(default=False),
    remove_cover_image: bool = Form(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Group:
    group = _get_group_or_404(db, group_id)
    creator_access = group.created_by == current_user.id
    membership = _get_group_membership(db, group.id, current_user.id)
    membership_role = membership.role if membership else None
    admin_access = creator_access or membership_role == GroupMemberRole.admin
    moderator_access = membership_role == GroupMemberRole.moderator

    if not (admin_access or moderator_access):
        raise HTTPException(status_code=403, detail="Not allowed")

    if name is not None and not admin_access:
        raise HTTPException(status_code=403, detail="Only group admins can change the group name")

    if privacy is not None and not admin_access:
        raise HTTPException(status_code=403, detail="Only group admins can change privacy")

    if visible is not None and not admin_access:
        raise HTTPException(status_code=403, detail="Only group admins can change visibility")

    if status_value is not None and not admin_access:
        raise HTTPException(status_code=403, detail="Only group admins can change group status")

    if (remove_group_image or (group_image is not None and group_image.filename)) and not admin_access:
        raise HTTPException(status_code=403, detail="Only group admins can update the group photo")

    if (remove_cover_image or (cover_image is not None and cover_image.filename)) and not (admin_access or moderator_access):
        raise HTTPException(status_code=403, detail="Only admins or moderators can update the cover photo")

    if name is not None:
        clean_name = name.strip()
        if len(clean_name) < 2:
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
        group.name = clean_name

    if description is not None:
        group.description = description.strip() or None

    parsed_privacy = _parse_privacy(privacy, required=False)
    if parsed_privacy is not None:
        group.privacy = parsed_privacy

    parsed_status = _parse_status(status_value)
    if parsed_status is not None:
        group.status = parsed_status

    if visible is not None:
        group.visible = bool(visible)

    if remove_group_image:
        _delete_group_media(group.group_image)
        group.group_image = None

    if remove_cover_image:
        _delete_group_media(group.cover_image)
        group.cover_image = None

    if group_image is not None and group_image.filename:
        group.group_image = await _save_group_media(
            group.id,
            group_image,
            "profile",
            group.group_image,
        )

    if cover_image is not None and cover_image.filename:
        group.cover_image = await _save_group_media(
            group.id,
            cover_image,
            "cover",
            group.cover_image,
        )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Group name already exists")

    db.refresh(group)
    return group


@router.post("/{group_id}/join", response_model=GroupMemberOut, status_code=status.HTTP_201_CREATED)
def join_public_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupMember:
    group = _get_group_or_404(db, group_id)

    if group.status != GroupStatus.active:
        raise HTTPException(status_code=400, detail="Group is not active")

    if group.privacy != GroupPrivacy.public:
        raise HTTPException(status_code=400, detail="Only public groups can be joined directly")

    existing_member = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == group.id,
            GroupMember.user_id == current_user.id,
        )
        .first()
    )
    if existing_member:
        raise HTTPException(status_code=400, detail="You are already a member of this group")

    member = GroupMember(
        group_id=group.id,
        user_id=current_user.id,
        role=GroupMemberRole.member,
    )
    db.add(member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not join this group")

    db.refresh(member)
    return member


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

    _delete_group_media(group.group_image)
    _delete_group_media(group.cover_image)

    db.delete(group)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
