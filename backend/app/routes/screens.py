from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Screen, Seat, Theatre
from app.schemas.theatre import ScreenCreate, ScreenDetail, ScreenOut, ScreenUpdate, SeatOut, SeatToggle
from app.services.deps import require_admin
from app.services.screen_service import rebuild_seats
from app.services.serializers import screen_out

router = APIRouter(prefix="/screens", tags=["Screens"])


def _load(db: Session, screen_id: int) -> Screen:
    s = db.scalar(
        select(Screen)
        .where(Screen.id == screen_id)
        .options(selectinload(Screen.seats), selectinload(Screen.theatre))
    )
    if s is None:
        raise HTTPException(404, "Screen not found")
    return s


def _detail(s: Screen) -> ScreenDetail:
    return ScreenDetail(
        **screen_out(s).model_dump(),
        theatre_name=s.theatre.name,
        seats=[SeatOut.model_validate(x) for x in s.seats],
    )


@router.get("", response_model=list[ScreenOut])
def list_screens(theatre_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(Screen).options(selectinload(Screen.seats)).order_by(Screen.theatre_id, Screen.name)
    if theatre_id is not None:
        stmt = stmt.where(Screen.theatre_id == theatre_id)
    return [screen_out(s) for s in db.scalars(stmt).all()]


@router.get("/{screen_id}", response_model=ScreenDetail)
def get_screen(screen_id: int, db: Session = Depends(get_db)):
    return _detail(_load(db, screen_id))


@router.post("", response_model=ScreenDetail, status_code=201, dependencies=[Depends(require_admin)])
def create_screen(data: ScreenCreate, db: Session = Depends(get_db)):
    if db.get(Theatre, data.theatre_id) is None:
        raise HTTPException(404, "Theatre not found")
    payload = data.model_dump(mode="json")
    screen = Screen(**payload)
    db.add(screen)
    rebuild_seats(db, screen)
    db.commit()
    return _detail(_load(db, screen.id))


@router.put("/{screen_id}", response_model=ScreenDetail, dependencies=[Depends(require_admin)])
def update_screen(screen_id: int, data: ScreenUpdate, db: Session = Depends(get_db)):
    screen = _load(db, screen_id)
    payload = data.model_dump(mode="json")
    layout_changed = (
        payload["seats_per_row"] != screen.seats_per_row or payload["seat_layout"] != screen.seat_layout
    )
    for k, v in payload.items():
        setattr(screen, k, v)
    if layout_changed:
        rebuild_seats(db, screen)
    db.commit()
    return _detail(_load(db, screen_id))


@router.delete("/{screen_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_screen(screen_id: int, db: Session = Depends(get_db)):
    screen = db.get(Screen, screen_id)
    if screen is None:
        raise HTTPException(404, "Screen not found")
    db.delete(screen)
    db.commit()


@router.patch("/seats/{seat_id}", response_model=SeatOut, dependencies=[Depends(require_admin)])
def toggle_seat(seat_id: int, data: SeatToggle, db: Session = Depends(get_db)):
    """Enable or disable a single seat (e.g. broken seat, wheelchair space)."""
    seat = db.get(Seat, seat_id)
    if seat is None:
        raise HTTPException(404, "Seat not found")
    seat.is_active = data.is_active
    db.commit()
    db.refresh(seat)
    return seat
