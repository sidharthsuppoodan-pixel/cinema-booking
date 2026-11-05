"""Booking engine: seat reservation with concurrency protection, pricing,
simulated payment capture and the cancellation / refund policy."""
import secrets
import string
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Booking, BookingSeat, Payment, Seat, Showtime, User
from app.models.enums import BookingStatus, PaymentStatus, UserRole
from app.schemas.booking import BookingCreate, CancellationQuote

_ALPHABET = string.ascii_uppercase + string.digits
TWO_PLACES = Decimal("0.01")


def _money(v: Decimal | float) -> Decimal:
    return Decimal(str(v)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _code(prefix: str, n: int) -> str:
    return prefix + "".join(secrets.choice(_ALPHABET) for _ in range(n))


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_booking(db: Session, user: User, data: BookingCreate) -> Booking:
    if len(data.seat_ids) > settings.max_seats_per_booking:
        raise HTTPException(400, f"You can book at most {settings.max_seats_per_booking} seats at a time")

    # Lock the showtime row: concurrent bookings for the same show are serialised
    # here, so the availability check below cannot race. The partial unique index
    # on booking_seats is the final database-level guarantee.
    showtime = db.execute(
        select(Showtime).where(Showtime.id == data.showtime_id).with_for_update()
    ).scalar_one_or_none()
    if showtime is None or not showtime.is_active:
        raise HTTPException(404, "Showtime not found or no longer available")
    if not showtime.movie.is_active or not showtime.screen.is_active or not showtime.screen.theatre.is_active:
        raise HTTPException(400, "This show is not open for booking")
    if showtime.start_time <= utcnow():
        raise HTTPException(400, "This show has already started; booking is closed")

    seats = db.scalars(
        select(Seat).where(
            Seat.id.in_(data.seat_ids), Seat.screen_id == showtime.screen_id, Seat.is_active
        )
    ).all()
    if len(seats) != len(data.seat_ids):
        raise HTTPException(400, "One or more selected seats are invalid for this show")

    taken = db.scalars(
        select(BookingSeat.seat_label).where(
            BookingSeat.showtime_id == showtime.id,
            BookingSeat.seat_id.in_(data.seat_ids),
            BookingSeat.is_active,
        )
    ).all()
    if taken:
        raise HTTPException(
            409, f"Sorry, seat(s) {', '.join(sorted(taken))} were just booked by someone else. Please pick other seats."
        )

    subtotal = Decimal("0")
    booking_seats = []
    for seat in sorted(seats, key=lambda s: (s.row_index, s.seat_number)):
        price = _money(showtime.price_for(seat.category))
        subtotal += price
        booking_seats.append(
            BookingSeat(
                showtime_id=showtime.id,
                seat_id=seat.id,
                seat_label=seat.label,
                category=seat.category,
                price=price,
            )
        )
    fee = _money(Decimal(str(settings.convenience_fee_per_ticket)) * len(seats))
    total = _money(subtotal + fee)

    booking = Booking(
        booking_code=_code("CB", 8),
        user_id=user.id,
        showtime_id=showtime.id,
        status=BookingStatus.CONFIRMED.value,
        seat_count=len(seats),
        subtotal=_money(subtotal),
        convenience_fee=fee,
        total_amount=total,
        seats=booking_seats,
    )
    # Payments are simulated (no real gateway is integrated); capture succeeds immediately.
    booking.payment = Payment(
        amount=total,
        method=data.payment_method.value,
        status=PaymentStatus.PAID.value,
        transaction_ref=_code("TXN", 14),
        paid_at=utcnow(),
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Some of the selected seats were just booked. Please refresh and try again.") from None
    db.refresh(booking)
    return booking


def cancellation_quote(booking: Booking, actor: User) -> CancellationQuote:
    hours = (booking.showtime.start_time - utcnow()).total_seconds() / 3600
    is_admin = actor.role == UserRole.ADMIN.value
    subtotal = Decimal(booking.subtotal)

    def no(reason: str) -> CancellationQuote:
        return CancellationQuote(
            cancellable=False, reason=reason, refund_percent=0, refund_amount=0, hours_to_show=round(hours, 2)
        )

    if booking.status != BookingStatus.CONFIRMED.value:
        return no(f"Booking is already {booking.status.lower()}")
    if is_admin:
        return CancellationQuote(
            cancellable=True,
            reason="Administrator cancellation: full refund including convenience fee",
            refund_percent=100,
            refund_amount=_money(booking.total_amount),
            hours_to_show=round(hours, 2),
        )
    if hours < settings.cancellation_cutoff_hours:
        return no(
            f"Online cancellation closes {settings.cancellation_cutoff_hours:g} hours before showtime"
        )
    if hours >= settings.full_refund_hours:
        pct = Decimal("100")
        reason = f"Cancelled {settings.full_refund_hours:g}+ hours before the show: full ticket refund"
    else:
        pct = Decimal(str(settings.partial_refund_percent))
        reason = (
            f"Cancelled less than {settings.full_refund_hours:g} hours before the show: "
            f"{float(pct):g}% ticket refund"
        )
    reason += " (convenience fee is non-refundable)"
    return CancellationQuote(
        cancellable=True,
        reason=reason,
        refund_percent=float(pct),
        refund_amount=_money(subtotal * pct / 100),
        hours_to_show=round(hours, 2),
    )


def cancel_booking(db: Session, booking: Booking, actor: User, reason: str | None) -> Booking:
    quote = cancellation_quote(booking, actor)
    if not quote.cancellable:
        raise HTTPException(400, quote.reason)
    booking.status = BookingStatus.CANCELLED.value
    booking.cancelled_at = utcnow()
    booking.cancellation_reason = reason or (
        "Cancelled by administrator" if actor.role == UserRole.ADMIN.value else "Cancelled by customer"
    )
    for bs in booking.seats:
        bs.is_active = False  # release seats for re-sale
    if booking.payment and booking.payment.status == PaymentStatus.PAID.value:
        refund = _money(quote.refund_amount)
        booking.payment.refund_amount = refund
        booking.payment.status = (
            PaymentStatus.REFUNDED.value
            if refund >= _money(booking.payment.amount)
            else PaymentStatus.PARTIALLY_REFUNDED.value
        )
    db.commit()
    db.refresh(booking)
    return booking


def admin_update_status(
    db: Session,
    booking: Booking,
    actor: User,
    status: BookingStatus | None,
    payment_status: PaymentStatus | None,
    reason: str | None,
) -> Booking:
    if status is not None and status.value != booking.status:
        current = booking.status
        if status == BookingStatus.CANCELLED:
            return cancel_booking(db, booking, actor, reason)
        if current == BookingStatus.CANCELLED.value:
            raise HTTPException(
                400, "A cancelled booking cannot be reinstated (its seats may have been resold)."
            )
        booking.status = status.value  # CONFIRMED <-> COMPLETED
    if payment_status is not None:
        if booking.payment is None:
            raise HTTPException(400, "Booking has no payment record")
        booking.payment.status = payment_status.value
        if payment_status == PaymentStatus.PAID and booking.payment.paid_at is None:
            booking.payment.paid_at = utcnow()
        if payment_status == PaymentStatus.REFUNDED:
            booking.payment.refund_amount = booking.payment.amount
    db.commit()
    db.refresh(booking)
    return booking
