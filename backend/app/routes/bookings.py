from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.models import Booking, Screen, Showtime, User
from app.models.enums import UserRole
from app.schemas.booking import BookingCreate, BookingOut, CancellationQuote, CancelRequest
from app.services import booking_service
from app.services.deps import get_current_user, require_customer
from app.services.serializers import booking_out

router = APIRouter(prefix="/bookings", tags=["Bookings"])

BOOKING_LOAD = (
    joinedload(Booking.showtime).joinedload(Showtime.movie),
    joinedload(Booking.showtime).joinedload(Showtime.screen).joinedload(Screen.theatre),
    joinedload(Booking.user),
    selectinload(Booking.seats),
    joinedload(Booking.payment),
)


def load_booking(db: Session, code: str) -> Booking:
    b = db.scalar(select(Booking).where(Booking.booking_code == code.upper().strip()).options(*BOOKING_LOAD))
    if b is None:
        raise HTTPException(404, "Booking not found")
    return b


def _owned(db: Session, code: str, user: User) -> Booking:
    b = load_booking(db, code)
    if user.role != UserRole.ADMIN.value and b.user_id != user.id:
        raise HTTPException(404, "Booking not found")  # don't leak existence
    return b


@router.post("", response_model=BookingOut, status_code=201)
def create_booking(data: BookingCreate, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    booking = booking_service.create_booking(db, user, data)
    b = load_booking(db, booking.booking_code)
    return booking_out(b, booking_service.cancellation_quote(b, user))


@router.get("/me", response_model=list[BookingOut])
def my_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Booking).where(Booking.user_id == user.id).options(*BOOKING_LOAD).order_by(Booking.created_at.desc())
    ).unique().all()
    return [booking_out(b, booking_service.cancellation_quote(b, user)) for b in rows]


@router.get("/{code}", response_model=BookingOut)
def get_booking(code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = _owned(db, code, user)
    return booking_out(b, booking_service.cancellation_quote(b, user))


@router.get("/{code}/cancellation", response_model=CancellationQuote)
def get_cancellation_quote(code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return booking_service.cancellation_quote(_owned(db, code, user), user)


@router.post("/{code}/cancel", response_model=BookingOut)
def cancel_booking(
    code: str,
    data: CancelRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = _owned(db, code, user)
    booking_service.cancel_booking(db, b, user, data.reason if data else None)
    b = load_booking(db, code)
    return booking_out(b, booking_service.cancellation_quote(b, user))
