"""Convert ORM objects into response schemas with denormalised display fields."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, BookingSeat, Screen, Seat, Showtime, Theatre
from app.schemas.booking import BookingOut, BookingSeatOut, PaymentOut
from app.schemas.showtime import ShowtimeOut
from app.schemas.theatre import ScreenOut, TheatreOut
from app.services.screen_service import screen_stats


def screen_out(screen: Screen) -> ScreenOut:
    return ScreenOut.model_validate({**ScreenOut.model_validate(screen).model_dump(), **screen_stats(screen)})


def theatre_out(theatre: Theatre) -> TheatreOut:
    data = TheatreOut.model_validate(theatre)
    data.screen_count = len(theatre.screens)
    return data


def _capacity_by_screen(db: Session, screen_ids: set[int]) -> dict[int, int]:
    if not screen_ids:
        return {}
    rows = db.execute(
        select(Seat.screen_id, func.count(Seat.id))
        .where(Seat.screen_id.in_(screen_ids), Seat.is_active)
        .group_by(Seat.screen_id)
    ).all()
    return {sid: cnt for sid, cnt in rows}


def _booked_by_showtime(db: Session, showtime_ids: set[int]) -> dict[int, int]:
    if not showtime_ids:
        return {}
    rows = db.execute(
        select(BookingSeat.showtime_id, func.count(BookingSeat.id))
        .where(BookingSeat.showtime_id.in_(showtime_ids), BookingSeat.is_active)
        .group_by(BookingSeat.showtime_id)
    ).all()
    return {sid: cnt for sid, cnt in rows}


def showtimes_out(db: Session, showtimes: list[Showtime]) -> list[ShowtimeOut]:
    caps = _capacity_by_screen(db, {s.screen_id for s in showtimes})
    booked = _booked_by_showtime(db, {s.id for s in showtimes})
    out = []
    for s in showtimes:
        cap = caps.get(s.screen_id, 0)
        b = booked.get(s.id, 0)
        out.append(
            ShowtimeOut(
                id=s.id,
                movie_id=s.movie_id,
                movie_title=s.movie.title,
                movie_poster_url=s.movie.poster_url,
                movie_duration=s.movie.duration_minutes,
                movie_certificate=s.movie.certificate,
                screen_id=s.screen_id,
                screen_name=s.screen.name,
                screen_type=s.screen.screen_type,
                theatre_id=s.screen.theatre_id,
                theatre_name=s.screen.theatre.name,
                theatre_city=s.screen.theatre.city,
                start_time=s.start_time,
                end_time=s.end_time,
                language=s.language or s.movie.language,
                price_standard=s.price_standard,
                price_premium=s.price_premium,
                price_recliner=s.price_recliner,
                is_active=s.is_active,
                capacity=cap,
                booked_count=b,
                available_count=max(cap - b, 0),
            )
        )
    return out


def showtime_out(db: Session, showtime: Showtime) -> ShowtimeOut:
    return showtimes_out(db, [showtime])[0]


def booking_out(booking: Booking, quote=None) -> BookingOut:
    st = booking.showtime
    screen = st.screen
    theatre = screen.theatre
    user = booking.user
    return BookingOut(
        id=booking.id,
        booking_code=booking.booking_code,
        status=booking.status,
        seat_count=booking.seat_count,
        subtotal=booking.subtotal,
        convenience_fee=booking.convenience_fee,
        total_amount=booking.total_amount,
        created_at=booking.created_at,
        cancelled_at=booking.cancelled_at,
        cancellation_reason=booking.cancellation_reason,
        seats=[BookingSeatOut.model_validate(s) for s in sorted(booking.seats, key=_seat_sort)],
        payment=PaymentOut.model_validate(booking.payment) if booking.payment else None,
        showtime_id=st.id,
        start_time=st.start_time,
        end_time=st.end_time,
        movie_id=st.movie_id,
        movie_title=st.movie.title,
        movie_poster_url=st.movie.poster_url,
        movie_certificate=st.movie.certificate,
        language=st.language or st.movie.language,
        theatre_name=theatre.name,
        theatre_address=theatre.address,
        theatre_city=theatre.city,
        screen_name=screen.name,
        screen_type=screen.screen_type,
        customer_id=user.id,
        customer_name=user.full_name,
        customer_email=user.email,
        customer_phone=user.phone,
        cancellation=quote,
    )


def _seat_sort(bs: BookingSeat):
    label = bs.seat_label
    return (label[0], int(label[1:]) if label[1:].isdigit() else 0)
