from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.models.enums import ScreenType, SeatCategory
from app.schemas.common import ORMModel

Str = lambda n: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=n)]  # noqa: E731
OptStr = lambda n: Annotated[str, StringConstraints(strip_whitespace=True, max_length=n)] | None  # noqa: E731


class TheatreBase(BaseModel):
    name: Str(150)
    address: Str(300)
    city: Str(100)
    state: OptStr(100) = None
    pincode: OptStr(12) = None
    contact_phone: OptStr(20) = None
    amenities: OptStr(300) = None
    is_active: bool = True


class TheatreCreate(TheatreBase):
    pass


class TheatreUpdate(TheatreBase):
    pass


class LayoutBlock(BaseModel):
    category: SeatCategory
    rows: int = Field(gt=0, le=26)


class ScreenBase(BaseModel):
    name: Str(60)
    screen_type: ScreenType = ScreenType.TWO_D
    seats_per_row: int = Field(gt=0, le=40)
    seat_layout: list[LayoutBlock] = Field(min_length=1)
    is_active: bool = True

    @field_validator("seat_layout")
    @classmethod
    def total_rows(cls, v: list[LayoutBlock]) -> list[LayoutBlock]:
        if sum(b.rows for b in v) > 26:
            raise ValueError("A screen can have at most 26 rows (A-Z)")
        return v


class ScreenCreate(ScreenBase):
    theatre_id: int


class ScreenUpdate(ScreenBase):
    pass


class SeatOut(ORMModel):
    id: int
    row_label: str
    row_index: int
    seat_number: int
    category: SeatCategory
    is_active: bool


class SeatToggle(BaseModel):
    is_active: bool


class ScreenOut(ORMModel):
    id: int
    theatre_id: int
    name: str
    screen_type: ScreenType
    seats_per_row: int
    seat_layout: list[LayoutBlock]
    is_active: bool
    capacity: int = 0
    category_counts: dict[str, int] = {}
    created_at: datetime


class ScreenDetail(ScreenOut):
    theatre_name: str
    seats: list[SeatOut]


class TheatreOut(ORMModel):
    id: int
    name: str
    address: str
    city: str
    state: str | None
    pincode: str | None
    contact_phone: str | None
    amenities: str | None
    is_active: bool
    created_at: datetime
    screen_count: int = 0


class TheatreDetail(TheatreOut):
    screens: list[ScreenOut]
