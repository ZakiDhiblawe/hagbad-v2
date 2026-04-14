from __future__ import annotations

from datetime import timedelta
from pathlib import Path
import re
from typing import Final
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.user.models import User, UserStatus
from app.user.schemas import Token, UserCreate, UserOut, UserPasswordUpdate
from utility.security import (
    create_access_token,
    get_current_user,
    get_db,
    get_password_hash,
    verify_password,
)

router = APIRouter(tags=["users"])

BACKEND_DIR: Final[Path] = Path(__file__).resolve().parents[2]
PROFILE_DIR: Final[Path] = BACKEND_DIR / "files" / "profile"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_EXTENSIONS: Final[set[str]] = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_PROFILE_IMAGE_BYTES: Final[int] = 5 * 1024 * 1024
PHONE_PATTERN: Final[re.Pattern[str]] = re.compile(r"^[0-9+\-\s()]{6,30}$")
MAX_SESSION_HOURS: Final[int] = 720


def _normalize_profile_extension(upload: UploadFile) -> str:
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
            detail="Profile image must be JPG, PNG, WEBP, or GIF",
        )

    return suffix


def _delete_profile_image(path_value: str | None) -> None:
    if not path_value or not path_value.startswith("/files/profile/"):
        return

    target = BACKEND_DIR / path_value.lstrip("/")
    if target.is_file():
        target.unlink()


async def _save_profile_image(user_id: int, upload: UploadFile, existing_path: str | None) -> str:
    suffix = _normalize_profile_extension(upload)
    destination = PROFILE_DIR / f"{user_id}{suffix}"
    data = await upload.read()

    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded profile image is empty",
        )

    if len(data) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile image must be 5 MB or smaller",
        )

    new_path = f"/files/profile/{destination.name}"
    if existing_path and existing_path != new_path:
        _delete_profile_image(existing_path)

    destination.write_bytes(data)
    await upload.close()
    return new_path


def _parse_session_hours(raw_value: str | None) -> int | None:
    value = (raw_value or "").strip()
    if not value:
        return None

    if not value.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session hours must be a whole number or blank",
        )

    hours = int(value)
    if hours < 1 or hours > MAX_SESSION_HOURS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session hours must be between 1 and {MAX_SESSION_HOURS}",
        )
    return hours


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        session_hours=None,
        password=get_password_hash(payload.password),
        status=UserStatus.active,
    )

    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    # OAuth2 form field is called "username" – we treat it as the email.
    email = form_data.username
    password = form_data.password

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status == UserStatus.banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is banned",
        )

    session_id = uuid4().hex
    user.active_session_id = session_id
    db.commit()

    expires_delta = None
    if user.session_hours is not None:
        expires_delta = timedelta(hours=user.session_hours)

    access_token = create_access_token({"sub": user.email, "sid": session_id}, expires_delta=expires_delta)
    return Token(access_token=access_token, token_type="bearer")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    current_user.active_session_id = None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/profile", response_model=UserOut)
def profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.put("/profile", response_model=UserOut)
async def update_profile(
    full_name: str = Form(...),
    phone: str | None = Form(default=None),
    session_hours: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    remove_image: bool = Form(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    full_name = full_name.strip()
    if len(full_name) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name must be at least 2 characters",
        )

    current_user.full_name = full_name
    phone = (phone or "").strip() or None
    if phone and not PHONE_PATTERN.fullmatch(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number must be 6 to 30 characters and contain only digits or + - ( )",
        )
    current_user.phone = phone
    current_user.session_hours = _parse_session_hours(session_hours)

    if remove_image:
        _delete_profile_image(current_user.profile_image)
        current_user.profile_image = None

    if image is not None and image.filename:
        current_user.profile_image = await _save_profile_image(
            current_user.id,
            image,
            current_user.profile_image,
        )

    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/profile/password")
def update_password(
    payload: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    if not verify_password(payload.current_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )

    current_user.password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
