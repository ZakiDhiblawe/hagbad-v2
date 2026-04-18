from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.cycle.models import Cycle, CycleFrequency, CycleStatus
from app.cycle_member.models import CycleMember
from app.group_member.models import GroupMember, GroupMemberRole
from app.group_settings.models import GroupSettings
from app.payment.models import Payment, PaymentStatus
from app.payment.schemas import PaymentCreate, PaymentDecision, PaymentOut, PaymentSubmission, PaymentSummary, PaymentUpdate
from app.payout.models import Payout, PayoutStatus
from app.user.models import User
from utility.security import get_current_user, get_db

router = APIRouter(prefix="/payments", tags=["payments"])


def get_cycle_or_404(db: Session, cycle_id: int) -> Cycle:
    cycle = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return cycle


def get_cycle_member_or_404(db: Session, cycle_member_id: int) -> CycleMember:
    member = db.query(CycleMember).filter(CycleMember.id == cycle_member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Cycle member not found")
    return member


def get_payment_or_404(db: Session, payment_id: int) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


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


def is_group_moderator_for_cycle(db: Session, cycle_id: int, user_id: int) -> bool:
    cycle = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not cycle:
        return False
    return (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == cycle.group_id,
            GroupMember.user_id == user_id,
            GroupMember.role == GroupMemberRole.moderator,
        )
        .first()
        is not None
    )


def require_cycle_manager(db: Session, cycle_id: int, user_id: int) -> None:
    if not (
        is_cycle_creator(db, cycle_id, user_id)
        or is_group_admin_for_cycle(db, cycle_id, user_id)
        or is_group_moderator_for_cycle(db, cycle_id, user_id)
    ):
        raise HTTPException(status_code=403, detail="Only a group admin or moderator can manage payments")


def can_view_payment(db: Session, payment: Payment, user_id: int) -> bool:
    if (
        is_cycle_creator(db, payment.cycle_id, user_id)
        or is_group_admin_for_cycle(db, payment.cycle_id, user_id)
        or is_group_moderator_for_cycle(db, payment.cycle_id, user_id)
    ):
        return True
    cycle_member = get_cycle_member_or_404(db, payment.cycle_member_id)
    return cycle_member.user_id == user_id


def require_payment_view_access(db: Session, payment: Payment, user_id: int) -> None:
    if not can_view_payment(db, payment, user_id):
        raise HTTPException(status_code=403, detail="Not allowed")


def get_group_settings_or_404(db: Session, group_id: int) -> GroupSettings:
    settings = db.query(GroupSettings).filter(GroupSettings.group_id == group_id).first()
    if not settings:
        raise HTTPException(status_code=400, detail="Group settings not found")
    return settings


def resolve_payment_status(*, amount_due: Decimal, amount_paid: Decimal, due_date: date) -> PaymentStatus:
    if amount_paid >= amount_due:
        return PaymentStatus.paid
    if due_date < date.today():
        return PaymentStatus.late
    return PaymentStatus.due


def normalize_payment_fields(
    *,
    amount_due: Decimal,
    amount_paid: Decimal,
    due_date: date,
    paid_at: datetime | None,
) -> tuple[PaymentStatus, datetime | None]:
    if amount_paid > amount_due:
        raise HTTPException(status_code=400, detail="amount_paid cannot be greater than amount_due")
    if paid_at is not None and amount_paid < amount_due:
        raise HTTPException(status_code=400, detail="Only fully submitted payments can be approved")

    if amount_paid >= amount_due and paid_at is not None:
        status_value = PaymentStatus.paid
        return status_value, paid_at or datetime.now(timezone.utc)

    status_value = PaymentStatus.late if due_date < date.today() else PaymentStatus.due
    return status_value, None


def sync_payment_status(payment: Payment) -> bool:
    new_status, new_paid_at = normalize_payment_fields(
        amount_due=payment.amount_due,
        amount_paid=payment.amount_paid,
        due_date=payment.due_date,
        paid_at=payment.paid_at,
    )
    changed = payment.status != new_status or payment.paid_at != new_paid_at
    payment.status = new_status
    payment.paid_at = new_paid_at
    return changed


def payment_is_pending_approval(payment: Payment) -> bool:
    return payment.amount_paid > 0 and payment.paid_at is None


def annotate_payment(payment: Payment) -> Payment:
    payment.pending_approval = payment_is_pending_approval(payment)
    return payment


def sync_cycle_payments(db: Session, cycle_id: int) -> None:
    items = db.query(Payment).filter(Payment.cycle_id == cycle_id).all()
    changed = False
    for item in items:
        changed = sync_payment_status(item) or changed
    if changed:
        db.commit()


def ensure_cycle_member_matches_cycle(cycle_id: int, cycle_member: CycleMember) -> None:
    if cycle_member.cycle_id != cycle_id:
        raise HTTPException(status_code=400, detail="cycle_member_id does not belong to the provided cycle")


def ensure_cycle_can_accept_payments(cycle: Cycle) -> None:
    if cycle.status != CycleStatus.active:
        raise HTTPException(status_code=400, detail="Payments can only be managed while the cycle is active")
    if cycle.status == CycleStatus.completed:
        raise HTTPException(status_code=400, detail="Cannot create payments for a completed cycle")


def get_cycle_members_sorted(db: Session, cycle_id: int) -> list[CycleMember]:
    return (
        db.query(CycleMember)
        .filter(CycleMember.cycle_id == cycle_id)
        .order_by(CycleMember.payout_order.asc(), CycleMember.created_at.asc(), CycleMember.id.asc())
        .all()
    )


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


def get_member_payout_round_due_date(db: Session, cycle: Cycle, cycle_member_id: int) -> date:
    custom_days = cycle.custom_days
    if cycle.frequency == CycleFrequency.custom_days and custom_days is None:
        custom_days = get_group_settings_or_404(db, cycle.group_id).custom_days

    interval_days = frequency_days(cycle.frequency, custom_days)
    members = get_cycle_members_sorted(db, cycle.id)
    for index, member in enumerate(members):
        if member.id == cycle_member_id:
            return cycle.start_date + timedelta(days=interval_days * index)

    raise HTTPException(status_code=400, detail="Cycle member does not belong to this cycle")


def payment_is_locked_by_processed_payout(db: Session, payment: Payment, cycle: Cycle) -> bool:
    payout = (
        db.query(Payout)
        .filter(
            Payout.cycle_member_id == payment.cycle_member_id,
            Payout.status.in_([PayoutStatus.approved, PayoutStatus.paid]),
        )
        .first()
    )
    if not payout:
        return False

    payout_round_due_date = get_member_payout_round_due_date(db, cycle, payment.cycle_member_id)
    return payment.due_date <= payout_round_due_date


def safe_decimal_sum(values: list[Decimal]) -> Decimal:
    total = Decimal("0")
    for value in values:
        total += value
    return total


@router.post("/", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payment:
    cycle = get_cycle_or_404(db, payload.cycle_id)
    require_cycle_manager(db, cycle.id, current_user.id)
    ensure_cycle_can_accept_payments(cycle)

    cycle_member = get_cycle_member_or_404(db, payload.cycle_member_id)
    ensure_cycle_member_matches_cycle(cycle.id, cycle_member)

    amount_due = payload.amount_due
    if amount_due is None:
        settings = get_group_settings_or_404(db, cycle.group_id)
        amount_due = settings.contribution_amount

    status_value, paid_at = normalize_payment_fields(
        amount_due=amount_due,
        amount_paid=payload.amount_paid,
        due_date=payload.due_date,
        paid_at=payload.paid_at,
    )

    payment = Payment(
        cycle_id=cycle.id,
        cycle_member_id=cycle_member.id,
        created_by=current_user.id,
        due_date=payload.due_date,
        amount_due=amount_due,
        amount_paid=payload.amount_paid,
        status=status_value,
        paid_at=paid_at,
        notes=payload.notes,
    )

    db.add(payment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Payment already exists for this cycle member on that due date")
    db.refresh(payment)
    return annotate_payment(payment)


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payment:
    payment = get_payment_or_404(db, payment_id)
    require_payment_view_access(db, payment, current_user.id)
    if sync_payment_status(payment):
        db.commit()
        db.refresh(payment)
    return annotate_payment(payment)


@router.get("/", response_model=list[PaymentOut])
def list_payments(
    cycle_id: int = Query(..., ge=1),
    cycle_member_id: int | None = Query(None, ge=1),
    status_filter: PaymentStatus | None = Query(None, alias="status"),
    due_from: date | None = Query(None),
    due_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Payment]:
    cycle = get_cycle_or_404(db, cycle_id)
    is_manager = (
        is_cycle_creator(db, cycle.id, current_user.id)
        or is_group_admin_for_cycle(db, cycle.id, current_user.id)
        or is_group_moderator_for_cycle(db, cycle.id, current_user.id)
    )
    sync_cycle_payments(db, cycle.id)

    query = db.query(Payment).filter(Payment.cycle_id == cycle.id)

    if cycle_member_id is not None:
        cycle_member = get_cycle_member_or_404(db, cycle_member_id)
        ensure_cycle_member_matches_cycle(cycle.id, cycle_member)
        query = query.filter(Payment.cycle_member_id == cycle_member.id)

    if not is_manager:
        own_cycle_member = (
            db.query(CycleMember)
            .filter(CycleMember.cycle_id == cycle.id, CycleMember.user_id == current_user.id)
            .first()
        )
        if not own_cycle_member:
            raise HTTPException(status_code=403, detail="Not allowed")
        query = query.filter(Payment.cycle_member_id == own_cycle_member.id)

    if status_filter is not None:
        query = query.filter(Payment.status == status_filter)
    if due_from is not None:
        query = query.filter(Payment.due_date >= due_from)
    if due_to is not None:
        query = query.filter(Payment.due_date <= due_to)

    items = (
        query.order_by(Payment.due_date.asc(), Payment.created_at.asc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    changed = False
    for item in items:
        changed = sync_payment_status(item) or changed
    if changed:
        db.commit()
        for item in items:
            db.refresh(item)

    return [annotate_payment(item) for item in items]


@router.get("/summary/cycle/{cycle_id}", response_model=PaymentSummary)
def get_cycle_payment_summary(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentSummary:
    cycle = get_cycle_or_404(db, cycle_id)
    require_cycle_manager(db, cycle.id, current_user.id)
    sync_cycle_payments(db, cycle.id)
    items = db.query(Payment).filter(Payment.cycle_id == cycle.id).all()

    due_count = sum(1 for item in items if item.status == PaymentStatus.due)
    paid_count = sum(1 for item in items if item.status == PaymentStatus.paid)
    late_count = sum(1 for item in items if item.status == PaymentStatus.late)
    total_amount_due = safe_decimal_sum([item.amount_due for item in items])
    total_amount_paid = safe_decimal_sum([item.amount_paid for item in items if item.status == PaymentStatus.paid])

    return PaymentSummary(
        cycle_id=cycle.id,
        total_payments=len(items),
        due_count=due_count,
        paid_count=paid_count,
        late_count=late_count,
        total_amount_due=total_amount_due,
        total_amount_paid=total_amount_paid,
        outstanding_amount=total_amount_due - total_amount_paid,
    )


@router.put("/{payment_id}", response_model=PaymentOut)
def update_payment(
    payment_id: int,
    payload: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payment:
    payment = get_payment_or_404(db, payment_id)
    cycle = get_cycle_or_404(db, payment.cycle_id)
    require_cycle_manager(db, payment.cycle_id, current_user.id)
    ensure_cycle_can_accept_payments(cycle)
    if payment_is_locked_by_processed_payout(db, payment, cycle):
        raise HTTPException(
            status_code=400,
            detail="Cannot edit payments from rounds already locked by an approved or paid payout",
        )

    if payload.due_date is not None:
        payment.due_date = payload.due_date
    if payload.amount_due is not None:
        payment.amount_due = payload.amount_due
    if payload.amount_paid is not None:
        payment.amount_paid = payload.amount_paid
    if payload.notes is not None:
        payment.notes = payload.notes

    payment.status, payment.paid_at = normalize_payment_fields(
        amount_due=payment.amount_due,
        amount_paid=payment.amount_paid,
        due_date=payment.due_date,
        paid_at=payload.paid_at if payload.amount_paid is not None or payload.paid_at is not None else payment.paid_at,
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Another payment already exists for this cycle member on that due date")
    db.refresh(payment)
    return annotate_payment(payment)


@router.put("/{payment_id}/submit", response_model=PaymentOut)
def submit_payment(
    payment_id: int,
    payload: PaymentSubmission,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payment:
    payment = get_payment_or_404(db, payment_id)
    cycle = get_cycle_or_404(db, payment.cycle_id)
    ensure_cycle_can_accept_payments(cycle)

    cycle_member = get_cycle_member_or_404(db, payment.cycle_member_id)
    if cycle_member.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the payment owner can submit this payment")
    if payment.status == PaymentStatus.paid or payment.paid_at is not None:
        raise HTTPException(status_code=400, detail="This payment is already approved")
    if payment_is_locked_by_processed_payout(db, payment, cycle):
        raise HTTPException(
            status_code=400,
            detail="Cannot submit payments for rounds already locked by an approved or paid payout",
        )

    submitted_amount = payload.amount_paid if payload.amount_paid is not None else payment.amount_due
    if submitted_amount != payment.amount_due:
        raise HTTPException(status_code=400, detail="Only the full scheduled contribution can be submitted for approval")

    payment.amount_paid = submitted_amount
    payment.paid_at = None
    if payload.notes is not None:
        payment.notes = payload.notes
    payment.status, payment.paid_at = normalize_payment_fields(
        amount_due=payment.amount_due,
        amount_paid=payment.amount_paid,
        due_date=payment.due_date,
        paid_at=None,
    )

    db.commit()
    db.refresh(payment)
    return annotate_payment(payment)


@router.put("/{payment_id}/approve", response_model=PaymentOut)
def approve_payment(
    payment_id: int,
    payload: PaymentDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payment:
    payment = get_payment_or_404(db, payment_id)
    cycle = get_cycle_or_404(db, payment.cycle_id)
    require_cycle_manager(db, payment.cycle_id, current_user.id)
    ensure_cycle_can_accept_payments(cycle)

    if payment.status == PaymentStatus.paid or payment.paid_at is not None:
        raise HTTPException(status_code=400, detail="This payment is already approved")
    if not payment_is_pending_approval(payment):
        raise HTTPException(status_code=400, detail="The member has not submitted this payment for approval yet")

    payment.status, payment.paid_at = normalize_payment_fields(
        amount_due=payment.amount_due,
        amount_paid=payment.amount_paid,
        due_date=payment.due_date,
        paid_at=datetime.now(timezone.utc),
    )
    if payload.notes is not None:
        payment.notes = payload.notes

    db.commit()
    db.refresh(payment)
    return annotate_payment(payment)


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    payment = get_payment_or_404(db, payment_id)
    cycle = get_cycle_or_404(db, payment.cycle_id)
    require_cycle_manager(db, payment.cycle_id, current_user.id)
    ensure_cycle_can_accept_payments(cycle)
    if payment_is_locked_by_processed_payout(db, payment, cycle):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete payments from rounds already locked by an approved or paid payout",
        )

    if payment.amount_paid > 0 or payment.status == PaymentStatus.paid:
        raise HTTPException(status_code=400, detail="Paid payment records cannot be deleted")

    db.delete(payment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
