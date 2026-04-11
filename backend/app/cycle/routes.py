from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.cycle.models import Cycle, CycleFrequency, CycleStatus
from app.cycle.schemas import CycleCreate, CycleOut, CycleUpdate
from app.cycle_member.models import CycleMember
from app.group.models import Group, GroupStatus
from app.group_member.models import GroupMember, GroupMemberRole
from app.group_settings.models import GroupSettings
from app.payment.models import Payment, PaymentStatus
from app.payout.models import Payout, PayoutStatus
from app.user.models import User
from utility.security import get_current_user, get_db

router = APIRouter(prefix="/cycles", tags=["cycles"])


def get_group_or_404(db: Session, group_id: int) -> Group:
    g = db.query(Group).filter(Group.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    return g


def get_cycle_or_404(db: Session, cycle_id: int) -> Cycle:
    c = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return c


def is_group_creator(db: Session, group_id: int, user_id: int) -> bool:
    return db.query(Group).filter(Group.id == group_id, Group.created_by == user_id).first() is not None


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
    if is_group_creator(db, group_id, user_id):
        return True
    return (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
        is not None
    )


def require_creator_or_admin(db: Session, group_id: int, user_id: int) -> None:
    if not (is_group_creator(db, group_id, user_id) or is_group_admin(db, group_id, user_id)):
        raise HTTPException(status_code=403, detail="Not allowed")


def require_member(db: Session, group_id: int, user_id: int) -> None:
    if not is_group_member(db, group_id, user_id):
        raise HTTPException(status_code=403, detail="Not allowed")


def require_lifecycle_manager(db: Session, group_id: int, user_id: int) -> None:
    if not (is_group_creator(db, group_id, user_id) or is_group_admin(db, group_id, user_id)):
        raise HTTPException(status_code=403, detail="Only the group creator or an admin can change cycle lifecycle")


def frequency_days(freq: CycleFrequency, custom_days: int | None) -> int:
    if freq == CycleFrequency.daily:
        return 1
    if freq == CycleFrequency.weekly:
        return 7
    if freq == CycleFrequency.monthly:
        return 30
    if freq == CycleFrequency.custom_days:
        if not custom_days:
            raise HTTPException(status_code=400, detail="custom_days is required for custom_days frequency")
        return int(custom_days)
    raise HTTPException(status_code=400, detail="Invalid frequency")


def compute_end_date(start: date, freq: CycleFrequency, custom_days: int | None) -> date:
    return start + timedelta(days=frequency_days(freq, custom_days))


def get_group_settings(db: Session, group_id: int) -> GroupSettings:
    s = db.query(GroupSettings).filter(GroupSettings.group_id == group_id).first()
    if not s:
        raise HTTPException(status_code=400, detail="Group settings not found")
    return s


def sync_cycle_payment_statuses(db: Session, cycle_id: int) -> None:
    payments = db.query(Payment).filter(Payment.cycle_id == cycle_id).all()
    changed = False
    for payment in payments:
        new_status = PaymentStatus.paid if payment.amount_paid >= payment.amount_due else (
            PaymentStatus.late if payment.due_date < date.today() else PaymentStatus.due
        )
        if payment.status != new_status:
            payment.status = new_status
            changed = True
    if changed:
        db.commit()


def ensure_cycle_ready_for_completion(db: Session, cycle: Cycle) -> None:
    sync_cycle_payment_statuses(db, cycle.id)

    participant_count = db.query(Payout.cycle_member_id).filter(Payout.cycle_id == cycle.id).count()

    cycle_member_total = db.query(CycleMember).filter(CycleMember.cycle_id == cycle.id).count()
    if cycle_member_total == 0:
        raise HTTPException(status_code=400, detail="Cycle must have participants before it can be completed")

    unsettled_payments = (
        db.query(Payment)
        .filter(Payment.cycle_id == cycle.id, Payment.status.in_([PaymentStatus.due, PaymentStatus.late]))
        .count()
    )
    if unsettled_payments > 0:
        raise HTTPException(status_code=400, detail="All cycle payments must be fully settled before completion")

    if participant_count != cycle_member_total:
        raise HTTPException(status_code=400, detail="Every cycle participant must have a payout record before completion")

    unpaid_payouts = (
        db.query(Payout)
        .filter(Payout.cycle_id == cycle.id, Payout.status != PayoutStatus.paid)
        .count()
    )
    if unpaid_payouts > 0:
        raise HTTPException(status_code=400, detail="Every payout must be marked as paid before completing the cycle")


@router.post("/", response_model=CycleOut, status_code=status.HTTP_201_CREATED)
def create_cycle(
    payload: CycleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Cycle:
    group = get_group_or_404(db, payload.group_id)
    require_creator_or_admin(db, group.id, current_user.id)

    if group.status != GroupStatus.active:
        raise HTTPException(status_code=400, detail="Cannot create a cycle for a closed group")

    cycle = Cycle(
        group_id=group.id,
        created_by=current_user.id,
        start_date=payload.start_date,
        frequency=payload.frequency,
        custom_days=payload.custom_days,
        status=CycleStatus.active if payload.auto_start else CycleStatus.pending,
    )

    # If auto_start, compute end_date (prefer group_settings.custom_days if needed)
    if payload.auto_start:
        settings = get_group_settings(db, group.id)
        cd = cycle.custom_days or settings.custom_days
        cycle.end_date = compute_end_date(cycle.start_date, cycle.frequency, cd)

    db.add(cycle)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create cycle")
    db.refresh(cycle)
    return cycle


@router.get("/{cycle_id}", response_model=CycleOut)
def get_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Cycle:
    cycle = get_cycle_or_404(db, cycle_id)
    require_member(db, cycle.group_id, current_user.id)
    return cycle


@router.get("/group/{group_id}", response_model=list[CycleOut])
def list_cycles_for_group(
    group_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Cycle]:
    get_group_or_404(db, group_id)
    require_member(db, group_id, current_user.id)

    offset = (page - 1) * size
    return (
        db.query(Cycle)
        .filter(Cycle.group_id == group_id)
        .order_by(Cycle.created_at.desc())
        .offset(offset)
        .limit(size)
        .all()
    )


@router.put("/{cycle_id}/start", response_model=CycleOut)
def start_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Cycle:
    cycle = get_cycle_or_404(db, cycle_id)
    require_lifecycle_manager(db, cycle.group_id, current_user.id)

    if cycle.status == CycleStatus.completed:
        raise HTTPException(status_code=400, detail="Cannot start a completed cycle")
    if cycle.status == CycleStatus.active:
        raise HTTPException(status_code=400, detail="Cycle is already active")
    if get_group_or_404(db, cycle.group_id).status != GroupStatus.active:
        raise HTTPException(status_code=400, detail="Cannot start a cycle in a closed group")

    cycle.status = CycleStatus.active

    # compute end_date using group_settings for custom_days fallback
    settings = get_group_settings(db, cycle.group_id)
    cd = cycle.custom_days or settings.custom_days
    cycle.end_date = compute_end_date(cycle.start_date, cycle.frequency, cd)

    db.commit()
    db.refresh(cycle)
    return cycle


@router.put("/{cycle_id}/stop", response_model=CycleOut)
def stop_cycle(
    cycle_id: int,
    stop_as: CycleStatus = Query(..., alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Cycle:
    cycle = get_cycle_or_404(db, cycle_id)
    require_lifecycle_manager(db, cycle.group_id, current_user.id)

    if stop_as not in (CycleStatus.paused, CycleStatus.completed):
        raise HTTPException(status_code=400, detail="status must be paused or completed")

    if cycle.status == CycleStatus.completed:
        raise HTTPException(status_code=400, detail="Cycle already completed")
    if cycle.status != CycleStatus.active:
        raise HTTPException(status_code=400, detail="Only active cycles can be stopped")
    if stop_as == CycleStatus.completed:
        ensure_cycle_ready_for_completion(db, cycle)

    cycle.status = stop_as
    if stop_as == CycleStatus.completed and cycle.end_date is None:
        cycle.end_date = date.today()

    db.commit()
    db.refresh(cycle)
    return cycle


@router.put("/{cycle_id}", response_model=CycleOut)
def update_cycle(
    cycle_id: int,
    payload: CycleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Cycle:
    cycle = get_cycle_or_404(db, cycle_id)
    require_creator_or_admin(db, cycle.group_id, current_user.id)

    if cycle.status == CycleStatus.completed:
        raise HTTPException(status_code=400, detail="Cannot update a completed cycle")
    if payload.status is not None:
        raise HTTPException(status_code=400, detail="Use the start/stop endpoints for lifecycle changes")

    if payload.frequency is not None:
        cycle.frequency = payload.frequency
        if payload.frequency != CycleFrequency.custom_days:
            cycle.custom_days = None

    if payload.custom_days is not None:
        cycle.custom_days = payload.custom_days

    if payload.end_date is not None:
        cycle.end_date = payload.end_date

    db.commit()
    db.refresh(cycle)
    return cycle
