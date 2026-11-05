from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, select
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.models import BookingSeat, Movie, Screen, Seat, Showtime, Theatre
from app.schemas.showtime import SeatMap, SeatMapRow, SeatMapSeat, ShowtimeCreate, ShowtimeOut, ShowtimeUpdate
from app.services.booking_service import utcnow
from app.services.deps import require_admin
from app.services.serializers import showtime_out, showtimes_out

router = APIRouter(prefix="/showtimes", tags=["Showtimes"])

_LOAD = (joinedload(Showtime.movie), joinedload(Showtime.screen).joinedload(Screen.theatre))


def _load(db: Session, showtime_id: int) -> Showtime:
    st = db.scalar(select(Showtime).where(Showtime.id == showtime_id).options(*_LOAD))
    if st is None:
        raise HTTPException(404, "Showtime not found")
    return st


@router.get("", response_model=list[ShowtimeOut])
def list_showtimes(
    movie_id: int | None = None,
    theatre_id: int | None = None,
    screen_id: int | None = None,
    city: str | None = Query(None, max_length=100),
    start_from: datetime | None = None,
    start_to: datetime | None = None,
    upcoming_only: bool = True,
    include_inactive: bool = False,
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    stmt = select(Showtime).join(Showtime.movie).join(Showtime.screen).join(Screen.theatre).options(*_LOAD)
    if not include_inactive:
        stmt = stmt.where(Showtime.is_active, Movie.is_active, Screen.is_active, Theatre.is_active)
    if movie_id is not None:
        stmt = stmt.where(Showtime.movie_id == movie_id)
    if screen_id is not None:
        stmt = stmt.where(Showtime.screen_id == screen_id)
    if theatre_id is not None:
        stmt = stmt.where(Screen.theatre_id == theatre_id)
    if city:
        stmt = stmt.where(Theatre.city.ilike(city.strip()))
    if upcoming_only:
        stmt = stmt.where(Showtime.start_time > utcnow())
    if start_from:
        stmt = stmt.where(Showtime.start_time >= start_from)
    if start_to:
        stmt = stmt.where(Showtime.start_time < start_to)
    rows = db.scalars(stmt.order_by(Showtime.start_time).limit(limit)).unique().all()
    return showtimes_out(db, list(rows))


@router.get("/{showtime_id}", response_model=ShowtimeOut)
def get_showtime(showtime_id: int, db: Session = Depends(get_db)):
    return showtime_out(db, _load(db, showtime_id))


@router.get("/{showtime_id}/seats", response_model=SeatMap)
def seat_map(showtime_id: int, db: Session = Depends(get_db)):
    st = _load(db, showtime_id)
    seats = db.scalars(
        select(Seat).where(Seat.screen_id == st.screen_id).order_by(Seat.row_index, Seat.seat_number)
    ).all()
    booked = set(
        db.scalars(
            select(BookingSeat.seat_id).where(BookingSeat.showtime_id == st.id, BookingSeat.is_active)
        ).all()
    )
    rows: dict[str, SeatMapRow] = {}
    for seat in seats:
        row = rows.setdefault(
            seat.row_label, SeatMapRow(row_label=seat.row_label, category=seat.category, seats=[])
        )
        status = "booked" if seat.id in booked else ("available" if seat.is_active else "blocked")
        row.seats.append(
            SeatMapSeat(
                id=seat.id,
                seat_number=seat.seat_number,
                label=seat.label,
                category=seat.category,
                price=st.price_for(seat.category),
                status=status,
            )
        )
    return SeatMap(
        showtime=showtime_out(db, st),
        seats_per_row=st.screen.seats_per_row,
        rows=list(rows.values()),
        convenience_fee_per_ticket=settings.convenience_fee_per_ticket,
        max_seats_per_booking=settings.max_seats_per_booking,
    )


def _validate_and_apply(db: Session, st: Showtime, data: ShowtimeCreate | ShowtimeUpdate) -> None:
    movie = db.get(Movie, data.movie_id)
    if movie is None:
        raise HTTPException(404, "Movie not found")
    screen = db.get(Screen, data.screen_id)
    if screen is None:
        raise HTTPException(404, "Screen not found")
    start = data.start_time
    end = start + timedelta(minutes=movie.duration_minutes + settings.showtime_cleanup_minutes)
    if data.is_active:
        clash_stmt = (
            select(Showtime)
            .options(joinedload(Showtime.movie))
            .where(
                Showtime.screen_id == data.screen_id,
                Showtime.is_active,
                Showtime.start_time < end,
                Showtime.end_time > start,
            )
        )
        if st.id is not None:
            clash_stmt = clash_stmt.where(Showtime.id != st.id)
        clash = db.scalars(clash_stmt).first()
        if clash:
            raise HTTPException(
                409,
                f"Screen '{screen.name}' is already booked for '{clash.movie.title}' "
                f"from {clash.start_time:%d %b %H:%M} to {clash.end_time:%H:%M} UTC. "
                "Showtimes on a screen cannot overlap (includes cleaning buffer).",
            )
    st.movie_id = data.movie_id
    st.screen_id = data.screen_id
    st.start_time = start
    st.end_time = end
    st.language = data.language or None
    st.price_standard = data.price_standard
    st.price_premium = data.price_premium
    st.price_recliner = data.price_recliner
    st.is_active = data.is_active


@router.post("", response_model=ShowtimeOut, status_code=201, dependencies=[Depends(require_admin)])
def create_showtime(data: ShowtimeCreate, db: Session = Depends(get_db)):
    if data.start_time <= utcnow():
        raise HTTPException(400, "Showtime must be scheduled in the future")
    st = Showtime()
    _validate_and_apply(db, st, data)
    db.add(st)
    db.commit()
    return showtime_out(db, _load(db, st.id))


@router.put("/{showtime_id}", response_model=ShowtimeOut, dependencies=[Depends(require_admin)])
def update_showtime(showtime_id: int, data: ShowtimeUpdate, db: Session = Depends(get_db)):
    st = _load(db, showtime_id)
    has_bookings = db.scalar(select(exists().where(BookingSeat.showtime_id == st.id, BookingSeat.is_active)))
    if has_bookings and (data.screen_id != st.screen_id or data.movie_id != st.movie_id):
        raise HTTPException(409, "Cannot change the movie or screen of a showtime that has active bookings")
    _validate_and_apply(db, st, data)
    db.commit()
    return showtime_out(db, _load(db, showtime_id))


@router.delete("/{showtime_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_showtime(showtime_id: int, db: Session = Depends(get_db)):
    st = db.get(Showtime, showtime_id)
    if st is None:
        raise HTTPException(404, "Showtime not found")
    db.delete(st)
    db.commit()
