import string
from collections import Counter

from fastapi import HTTPException
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models import BookingSeat, Screen, Seat


def generate_seats(screen: Screen) -> list[Seat]:
    """Build Seat rows for a screen from its layout (row A is nearest the screen)."""
    seats: list[Seat] = []
    row_index = 0
    for block in screen.seat_layout:
        for _ in range(int(block["rows"])):
            label = string.ascii_uppercase[row_index]
            for n in range(1, screen.seats_per_row + 1):
                seats.append(
                    Seat(row_label=label, row_index=row_index, seat_number=n, category=block["category"])
                )
            row_index += 1
    return seats


def screen_has_bookings(db: Session, screen_id: int) -> bool:
    stmt = select(
        exists().where(BookingSeat.seat_id == Seat.id, Seat.screen_id == screen_id)
    )
    return bool(db.scalar(stmt))


def rebuild_seats(db: Session, screen: Screen) -> None:
    if screen.id is not None and screen_has_bookings(db, screen.id):
        raise HTTPException(
            status_code=409,
            detail="The seat layout cannot be changed because seats on this screen have bookings. "
            "You can still enable/disable individual seats.",
        )
    screen.seats.clear()
    db.flush()
    screen.seats.extend(generate_seats(screen))


def screen_stats(screen: Screen) -> dict:
    active = [s for s in screen.seats if s.is_active]
    return {
        "capacity": len(active),
        "category_counts": dict(Counter(s.category for s in active)),
    }
