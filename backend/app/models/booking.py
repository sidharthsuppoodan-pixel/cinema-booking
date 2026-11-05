from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import BookingStatus, PaymentMethod, PaymentStatus

if TYPE_CHECKING:
    from app.models.showtime import Showtime
    from app.models.theatre import Seat
    from app.models.user import User


class Booking(TimestampMixin, Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint(f"status IN ({BookingStatus.sql_in()})", name="status_valid"),
        CheckConstraint("total_amount >= 0", name="total_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_code: Mapped[str] = mapped_column(String(16), nullable=False, unique=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # RESTRICT: a showtime that has bookings cannot be silently deleted.
    showtime_id: Mapped[int] = mapped_column(
        ForeignKey("showtimes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=BookingStatus.CONFIRMED.value
    )
    seat_count: Mapped[int] = mapped_column(Integer, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    convenience_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(String(300))

    user: Mapped["User"] = relationship(back_populates="bookings")
    showtime: Mapped["Showtime"] = relationship(back_populates="bookings")
    seats: Mapped[list["BookingSeat"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", passive_deletes=True
    )
    payment: Mapped["Payment | None"] = relationship(
        back_populates="booking", cascade="all, delete-orphan", passive_deletes=True, uselist=False
    )


class BookingSeat(Base):
    """A seat held by a booking.

    The partial unique index guarantees at the database level that a seat can
    only be held by one *active* booking per showtime. Cancelling a booking
    flips ``is_active`` to false, which releases the seat for re-sale.
    """

    __tablename__ = "booking_seats"
    __table_args__ = (
        Index(
            "uq_booking_seats_active_showtime_seat",
            "showtime_id",
            "seat_id",
            unique=True,
            postgresql_where=text("is_active"),
        ),
        CheckConstraint("price >= 0", name="price_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    showtime_id: Mapped[int] = mapped_column(
        ForeignKey("showtimes.id", ondelete="RESTRICT"), nullable=False
    )
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.id", ondelete="RESTRICT"), nullable=False)
    seat_label: Mapped[str] = mapped_column(String(8), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true())

    booking: Mapped[Booking] = relationship(back_populates="seats")
    seat: Mapped["Seat"] = relationship()


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(f"status IN ({PaymentStatus.sql_in()})", name="status_valid"),
        CheckConstraint(f"method IN ({PaymentMethod.sql_in()})", name="method_valid"),
        CheckConstraint("amount >= 0 AND refund_amount >= 0", name="amounts_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    refund_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    method: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=PaymentStatus.PENDING.value)
    transaction_ref: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    booking: Mapped[Booking] = relationship(back_populates="payment")
