from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.schemas.common import Money


class ShowtimeBase(BaseModel):
    movie_id: int
    screen_id: int
    start_time: datetime
    language: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None = None
    price_standard: float = Field(ge=0, le=100000)
    price_premium: float = Field(ge=0, le=100000)
    price_recliner: float = Field(ge=0, le=100000)
    is_active: bool = True

    @field_validator("start_time")
    @classmethod
    def tz_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("start_time must include a timezone offset (ISO 8601)")
        return v


class ShowtimeCreate(ShowtimeBase):
    pass


class ShowtimeUpdate(ShowtimeBase):
    pass


class ShowtimeOut(BaseModel):
    id: int
    movie_id: int
    movie_title: str
    movie_poster_url: str | None
    movie_duration: int
    movie_certificate: str | None
    screen_id: int
    screen_name: str
    screen_type: str
    theatre_id: int
    theatre_name: str
    theatre_city: str
    start_time: datetime
    end_time: datetime
    language: str | None
    price_standard: Money
    price_premium: Money
    price_recliner: Money
    is_active: bool
    capacity: int
    booked_count: int
    available_count: int


class SeatMapSeat(BaseModel):
    id: int
    seat_number: int
    label: str
    category: str
    price: Money
    status: str  # available | booked | blocked


class SeatMapRow(BaseModel):
    row_label: str
    category: str
    seats: list[SeatMapSeat]


class SeatMap(BaseModel):
    showtime: ShowtimeOut
    seats_per_row: int
    rows: list[SeatMapRow]
    convenience_fee_per_ticket: Money
    max_seats_per_booking: int
