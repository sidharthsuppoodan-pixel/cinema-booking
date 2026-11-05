from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import SeatCategory

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.movie import Movie
    from app.models.theatre import Screen


class Showtime(TimestampMixin, Base):
    __tablename__ = "showtimes"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="time_order"),
        CheckConstraint(
            "price_standard >= 0 AND price_premium >= 0 AND price_recliner >= 0",
            name="prices_non_negative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    movie_id: Mapped[int] = mapped_column(
        ForeignKey("movies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    screen_id: Mapped[int] = mapped_column(
        ForeignKey("screens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    language: Mapped[str | None] = mapped_column(String(60))
    price_standard: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    price_premium: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    price_recliner: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true())

    movie: Mapped["Movie"] = relationship(back_populates="showtimes")
    screen: Mapped["Screen"] = relationship(back_populates="showtimes")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="showtime", passive_deletes=True)

    def price_for(self, category: str) -> Decimal:
        return {
            SeatCategory.STANDARD.value: self.price_standard,
            SeatCategory.PREMIUM.value: self.price_premium,
            SeatCategory.RECLINER.value: self.price_recliner,
        }[category]
