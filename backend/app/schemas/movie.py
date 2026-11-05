from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.schemas.common import Money, ORMModel

Short = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


def _check_url(v: str | None) -> str | None:
    if v in (None, ""):
        return None
    v = v.strip()
    if not (v.startswith("http://") or v.startswith("https://") or v.startswith("/media/")):
        raise ValueError("Must be an http(s) URL or an uploaded /media/ path")
    return v


class MovieBase(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)] = ""
    genre: Short
    language: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    duration_minutes: int = Field(gt=0, le=600)
    rating: float | None = Field(default=None, ge=0, le=10)
    certificate: Annotated[str, StringConstraints(strip_whitespace=True, max_length=10)] | None = None
    release_date: date | None = None
    poster_url: Annotated[str, StringConstraints(max_length=500)] | None = None
    trailer_url: Annotated[str, StringConstraints(max_length=500)] | None = None
    cast_members: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    director: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] | None = None
    is_active: bool = True

    _urls = field_validator("poster_url", "trailer_url")(_check_url)


class MovieCreate(MovieBase):
    pass


class MovieUpdate(MovieBase):
    pass


class MovieOut(ORMModel):
    id: int
    title: str
    description: str
    genre: str
    language: str
    duration_minutes: int
    rating: Money | None
    certificate: str | None
    release_date: date | None
    poster_url: str | None
    trailer_url: str | None
    cast_members: str | None
    director: str | None
    is_active: bool
    created_at: datetime
