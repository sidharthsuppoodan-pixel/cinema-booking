from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Date, Integer, Numeric, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.showtime import Showtime


class Movie(TimestampMixin, Base):
    __tablename__ = "movies"
    __table_args__ = (
        CheckConstraint("duration_minutes > 0 AND duration_minutes <= 600", name="duration_valid"),
        CheckConstraint("rating IS NULL OR (rating >= 0 AND rating <= 10)", name="rating_valid"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    genre: Mapped[str] = mapped_column(String(120), nullable=False)
    language: Mapped[str] = mapped_column(String(60), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    rating: Mapped[float | None] = mapped_column(Numeric(3, 1))
    certificate: Mapped[str | None] = mapped_column(String(10))
    release_date: Mapped[date | None] = mapped_column(Date)
    poster_url: Mapped[str | None] = mapped_column(String(500))
    trailer_url: Mapped[str | None] = mapped_column(String(500))
    cast_members: Mapped[str | None] = mapped_column(String(500))
    director: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true())

    showtimes: Mapped[list["Showtime"]] = relationship(
        back_populates="movie", cascade="all, delete-orphan", passive_deletes=True
    )
