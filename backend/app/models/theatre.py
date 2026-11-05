from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import ScreenType, SeatCategory

if TYPE_CHECKING:
    from app.models.showtime import Showtime


class Theatre(TimestampMixin, Base):
    __tablename__ = "theatres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str] = mapped_column(String(300), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    state: Mapped[str | None] = mapped_column(String(100))
    pincode: Mapped[str | None] = mapped_column(String(12))
    contact_phone: Mapped[str | None] = mapped_column(String(20))
    amenities: Mapped[str | None] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true())

    screens: Mapped[list["Screen"]] = relationship(
        back_populates="theatre",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Screen.name",
    )


class Screen(TimestampMixin, Base):
    __tablename__ = "screens"
    __table_args__ = (
        UniqueConstraint("theatre_id", "name", name="uq_screens_theatre_name"),
        CheckConstraint(f"screen_type IN ({ScreenType.sql_in()})", name="type_valid"),
        CheckConstraint("seats_per_row > 0 AND seats_per_row <= 40", name="seats_per_row_valid"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    theatre_id: Mapped[int] = mapped_column(
        ForeignKey("theatres.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    screen_type: Mapped[str] = mapped_column(String(10), nullable=False, server_default="2D")
    seats_per_row: Mapped[int] = mapped_column(Integer, nullable=False)
    # Ordered from the row nearest the screen: [{"category": "STANDARD", "rows": 5}, ...]
    seat_layout: Mapped[list[dict]] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true())

    theatre: Mapped[Theatre] = relationship(back_populates="screens")
    seats: Mapped[list["Seat"]] = relationship(
        back_populates="screen",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=lambda: [Seat.row_index, Seat.seat_number],
    )
    showtimes: Mapped[list["Showtime"]] = relationship(
        back_populates="screen", cascade="all, delete-orphan", passive_deletes=True
    )


class Seat(Base):
    __tablename__ = "seats"
    __table_args__ = (
        UniqueConstraint("screen_id", "row_label", "seat_number", name="uq_seats_screen_row_number"),
        CheckConstraint(f"category IN ({SeatCategory.sql_in()})", name="category_valid"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    screen_id: Mapped[int] = mapped_column(
        ForeignKey("screens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    row_label: Mapped[str] = mapped_column(String(3), nullable=False)
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true())

    screen: Mapped[Screen] = relationship(back_populates="seats")

    @property
    def label(self) -> str:
        return f"{self.row_label}{self.seat_number}"
