from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.cycle.models import Cycle, CycleStatus
from app.cycle_member.models import CycleMember
from app.group_member.models import GroupMember, GroupMemberRole
from app.payment.models import Payment, PaymentStatus
from app.payout.models import Payout, PayoutStatus
from app.payout.schemas import PayoutCreate, PayoutDecision, PayoutOut, PayoutSummary, PayoutUpdate
from app.user.models import User
from utility.security import get_current_user, get_db

router = APIRouter(prefix="/payouts", tags=["payouts"])


def get_cycle_or_404(db: Session, cycle_id: int) -> Cycle:
    cycle = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return cycle


def get_cycle_member_or_404(db: Session, cycle_member_id: int) -> CycleMember:
    cycle_member = db.query(CycleMember).filter(CycleMember.id == cycle_member_id).first()
    if not cycle_member:
        raise HTTPException(status_code=404, detail="Cycle member not found")
    return cycle_member


def get_payout_or_404(db: Session, payout_id: int) -> Payout:
    payout = db.query(Payout).filter(Payout.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    return payout


def is_cycle_creator(db: Session, cycle_id: int, user_id: int) -> bool:
    return db.query(Cycle).filter(Cycle.id == cycle_id, Cycle.created_by == user_id).first() is not None


def is_group_admin_for_cycle(db: Session, cycle_id: int, user_id: int) -> bool:
    cycle = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not cycle:
        return False
    return (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == cycle.group_id,
            GroupMember.user_id == user_id,
            GroupMember.role == GroupMemberRole.admin,
        )
        .first()
        is not None
    )


def require_cycle_manager(db: Session, cycle_id: int, user_id: int) -> None:
    if not (is_cycle_creator(db, cycle_id, user_id) or is_group_admin_for_cycle(db, cycle_id, user_id)):
        raise HTTPException(status_code=403, detail="Only the cycle creator or a group admin can manage payouts")


def can_view_payout(db: Session, payout: Payout, user_id: int) -> bool:
    if is_cycle_creator(db, payout.cycle_id, user_id) or is_group_admin_for_cycle(db, payout.cycle_id, user_id):
        return True
    cycle_member = get_cycle_member_or_404(db, payout.cycle_member_id)
    return cycle_member.user_id == user_id


def require_payout_view_access(db: Session, payout: Payout, user_id: int) -> None:
    if not can_view_payout(db, payout, user_id):
        raise HTTPException(status_code=403, detail="Not allowed")


def ensure_cycle_member_matches_cycle(cycle_id: int, cycle_member: CycleMember) -> None:
    if cycle_member.cycle_id != cycle_id:
        raise HTTPException(status_code=400, detail="cycle_member_id does not belong to the provided cycle")


def ensure_cycle_not_completed(cycle: Cycle) -> None:
    if cycle.status == CycleStatus.completed:
        raise HTTPException(status_code=400, detail="Cannot manage payouts for a completed cycle")


def sync_cycle_payment_statuses(db: Session, cycle_id: int) -> None:
    payments = db.query(Payment).filter(Payment.cycle_id == cycle_id).all()
    changed = False
    for payment in payments:
        new_status = PaymentStatus.paid if payment.amount_paid >= payment.amount_due else (
            PaymentStatus.late if payment.due_date < datetime.now(timezone.utc).date() else PaymentStatus.due
        )
        new_paid_at = payment.paid_at
        if new_status == PaymentStatus.paid and payment.paid_at is None:
            new_paid_at = datetime.now(timezone.utc)
        if new_status != PaymentStatus.paid:
            new_paid_at = None
        if payment.status != new_status or payment.paid_at != new_paid_at:
            payment.status = new_status
            payment.paid_at = new_paid_at
            changed = True
    if changed:
        db.commit()


def cycle_has_unsettled_payments(db: Session, cycle_id: int) -> bool:
    sync_cycle_payment_statuses(db, cycle_id)
    return (
        db.query(Payment)
        .filter(Payment.cycle_id == cycle_id, Payment.status.in_([PaymentStatus.due, PaymentStatus.late]))
        .first()
        is not None
    )


def total_paid_into_cycle(db: Session, cycle_id: int) -> Decimal:
    total = Decimal("0")
    for payment in db.query(Payment).filter(Payment.cycle_id == cycle_id).all():
        total += payment.amount_paid
    return total


def total_paid_out_of_cycle(db: Session, cycle_id: int) -> Decimal:
    total = Decimal("0")
    for payout in db.query(Payout).filter(Payout.cycle_id == cycle_id, Payout.status == PayoutStatus.paid).all():
        total += payout.amount
    return total


def total_committed_payouts(db: Session, cycle_id: int, exclude_payout_id: int | None = None) -> Decimal:
    total = Decimal("0")
    query = db.query(Payout).filter(Payout.cycle_id == cycle_id, Payout.status.in_([PayoutStatus.approved, PayoutStatus.paid]))
    if exclude_payout_id is not None:
        query = query.filter(Payout.id != exclude_payout_id)
    for payout in query.all():
        total += payout.amount
    return total


def safe_decimal_sum(values: list[Decimal]) -> Decimal:
    total = Decimal("0")
    for value in values:
        total += value
    return total


@router.post("/", response_model=PayoutOut, status_code=status.HTTP_201_CREATED)
def create_payout(
    payload: PayoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payout:
    cycle = get_cycle_or_404(db, payload.cycle_id)
    require_cycle_manager(db, cycle.id, current_user.id)
    ensure_cycle_not_completed(cycle)

    cycle_member = get_cycle_member_or_404(db, payload.cycle_member_id)
    ensure_cycle_member_matches_cycle(cycle.id, cycle_member)

    payout = Payout(
        cycle_id=cycle.id,
        cycle_member_id=cycle_member.id,
        created_by=current_user.id,
        amount=payload.amount,
        notes=payload.notes,
        status=PayoutStatus.pending,
    )

    db.add(payout)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A payout already exists for this cycle member")
    db.refresh(payout)
    return payout


@router.get("/{payout_id}", response_model=PayoutOut)
def get_payout(
    payout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payout:
    payout = get_payout_or_404(db, payout_id)
    require_payout_view_access(db, payout, current_user.id)
    return payout


@router.get("/", response_model=list[PayoutOut])
def list_payouts(
    cycle_id: int = Query(..., ge=1),
    cycle_member_id: int | None = Query(None, ge=1),
    status_filter: PayoutStatus | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Payout]:
    cycle = get_cycle_or_404(db, cycle_id)
    is_manager = is_cycle_creator(db, cycle.id, current_user.id) or is_group_admin_for_cycle(db, cycle.id, current_user.id)

    query = db.query(Payout).filter(Payout.cycle_id == cycle.id)

    if cycle_member_id is not None:
        cycle_member = get_cycle_member_or_404(db, cycle_member_id)
        ensure_cycle_member_matches_cycle(cycle.id, cycle_member)
        query = query.filter(Payout.cycle_member_id == cycle_member.id)

    if not is_manager:
        own_cycle_member = (
            db.query(CycleMember)
            .filter(CycleMember.cycle_id == cycle.id, CycleMember.user_id == current_user.id)
            .first()
        )
        if not own_cycle_member:
            raise HTTPException(status_code=403, detail="Not allowed")
        query = query.filter(Payout.cycle_member_id == own_cycle_member.id)

    if status_filter is not None:
        query = query.filter(Payout.status == status_filter)

    return (
        query.order_by(Payout.created_at.asc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )


@router.get("/summary/cycle/{cycle_id}", response_model=PayoutSummary)
def get_payout_summary(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PayoutSummary:
    cycle = get_cycle_or_404(db, cycle_id)
    require_cycle_manager(db, cycle.id, current_user.id)

    payouts = db.query(Payout).filter(Payout.cycle_id == cycle.id).all()
    total_amount = safe_decimal_sum([payout.amount for payout in payouts])
    paid_amount = safe_decimal_sum([payout.amount for payout in payouts if payout.status == PayoutStatus.paid])

    return PayoutSummary(
        cycle_id=cycle.id,
        total_payouts=len(payouts),
        pending_count=sum(1 for payout in payouts if payout.status == PayoutStatus.pending),
        approved_count=sum(1 for payout in payouts if payout.status == PayoutStatus.approved),
        rejected_count=sum(1 for payout in payouts if payout.status == PayoutStatus.rejected),
        paid_count=sum(1 for payout in payouts if payout.status == PayoutStatus.paid),
        total_amount=total_amount,
        paid_amount=paid_amount,
        remaining_amount=total_amount - paid_amount,
    )


@router.put("/{payout_id}", response_model=PayoutOut)
def update_payout(
    payout_id: int,
    payload: PayoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payout:
    payout = get_payout_or_404(db, payout_id)
    cycle = get_cycle_or_404(db, payout.cycle_id)
    require_cycle_manager(db, cycle.id, current_user.id)
    ensure_cycle_not_completed(cycle)

    if payout.status in (PayoutStatus.approved, PayoutStatus.paid):
        raise HTTPException(status_code=400, detail="Approved or paid payouts cannot be edited directly")

    if payload.amount is not None:
        payout.amount = payload.amount
    if payload.notes is not None:
        payout.notes = payload.notes

    db.commit()
    db.refresh(payout)
    return payout


@router.put("/{payout_id}/approve", response_model=PayoutOut)
def approve_payout(
    payout_id: int,
    payload: PayoutDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payout:
    payout = get_payout_or_404(db, payout_id)
    cycle = get_cycle_or_404(db, payout.cycle_id)
    require_cycle_manager(db, cycle.id, current_user.id)
    ensure_cycle_not_completed(cycle)

    if payout.status == PayoutStatus.paid:
        raise HTTPException(status_code=400, detail="Paid payout is already final")
    if payout.status == PayoutStatus.approved:
        raise HTTPException(status_code=400, detail="Payout is already approved")
    if cycle_has_unsettled_payments(db, cycle.id):
        raise HTTPException(status_code=400, detail="All payments in the cycle must be settled before approving payouts")

    collected_total = total_paid_into_cycle(db, cycle.id)
    committed_total = total_committed_payouts(db, cycle.id, exclude_payout_id=payout.id)
    if committed_total + payout.amount > collected_total:
        raise HTTPException(status_code=400, detail="Payout amount exceeds the collected payments available in this cycle")

    payout.status = PayoutStatus.approved
    payout.approved_by = current_user.id
    payout.approved_at = datetime.now(timezone.utc)
    if payload.notes is not None:
        payout.notes = payload.notes

    db.commit()
    db.refresh(payout)
    return payout


@router.put("/{payout_id}/reject", response_model=PayoutOut)
def reject_payout(
    payout_id: int,
    payload: PayoutDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payout:
    payout = get_payout_or_404(db, payout_id)
    cycle = get_cycle_or_404(db, payout.cycle_id)
    require_cycle_manager(db, cycle.id, current_user.id)
    ensure_cycle_not_completed(cycle)

    if payout.status == PayoutStatus.paid:
        raise HTTPException(status_code=400, detail="Paid payout cannot be rejected")

    payout.status = PayoutStatus.rejected
    payout.approved_by = None
    payout.approved_at = None
    payout.paid_at = None
    if payload.notes is not None:
        payout.notes = payload.notes

    cycle_member = get_cycle_member_or_404(db, payout.cycle_member_id)
    cycle_member.received = False

    db.commit()
    db.refresh(payout)
    return payout


@router.put("/{payout_id}/pay", response_model=PayoutOut)
def mark_payout_paid(
    payout_id: int,
    payload: PayoutDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payout:
    payout = get_payout_or_404(db, payout_id)
    cycle = get_cycle_or_404(db, payout.cycle_id)
    require_cycle_manager(db, cycle.id, current_user.id)
    ensure_cycle_not_completed(cycle)

    if payout.status == PayoutStatus.paid:
        raise HTTPException(status_code=400, detail="Payout is already marked as paid")
    if payout.status != PayoutStatus.approved:
        raise HTTPException(status_code=400, detail="Only approved payouts can be marked as paid")

    collected_total = total_paid_into_cycle(db, cycle.id)
    already_paid_total = total_paid_out_of_cycle(db, cycle.id)
    if already_paid_total + payout.amount > collected_total:
        raise HTTPException(status_code=400, detail="Not enough collected payments are available to mark this payout as paid")

    payout.status = PayoutStatus.paid
    payout.paid_at = datetime.now(timezone.utc)
    if payload.notes is not None:
        payout.notes = payload.notes

    cycle_member = get_cycle_member_or_404(db, payout.cycle_member_id)
    cycle_member.received = True

    db.commit()
    db.refresh(payout)
    return payout


@router.delete("/{payout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payout(
    payout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    payout = get_payout_or_404(db, payout_id)
    cycle = get_cycle_or_404(db, payout.cycle_id)
    require_cycle_manager(db, cycle.id, current_user.id)
    ensure_cycle_not_completed(cycle)

    if payout.status in (PayoutStatus.approved, PayoutStatus.paid):
        raise HTTPException(status_code=400, detail="Approved or paid payouts cannot be deleted")

    db.delete(payout)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
