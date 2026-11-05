from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Movie
from app.schemas.movie import MovieCreate, MovieOut, MovieUpdate
from app.services.deps import require_admin

router = APIRouter(prefix="/movies", tags=["Movies"])


@router.get("", response_model=list[MovieOut])
def list_movies(
    q: str | None = Query(None, max_length=100),
    genre: str | None = Query(None, max_length=60),
    language: str | None = Query(None, max_length=60),
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    stmt = select(Movie)
    if not include_inactive:
        stmt = stmt.where(Movie.is_active)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Movie.title.ilike(like), Movie.cast_members.ilike(like), Movie.director.ilike(like)))
    if genre:
        stmt = stmt.where(Movie.genre.ilike(f"%{genre.strip()}%"))
    if language:
        stmt = stmt.where(Movie.language.ilike(language.strip()))
    return db.scalars(stmt.order_by(Movie.release_date.desc().nullslast(), Movie.title)).all()


@router.get("/{movie_id}", response_model=MovieOut)
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.get(Movie, movie_id)
    if movie is None:
        raise HTTPException(404, "Movie not found")
    return movie


@router.post("", response_model=MovieOut, status_code=201, dependencies=[Depends(require_admin)])
def create_movie(data: MovieCreate, db: Session = Depends(get_db)):
    movie = Movie(**data.model_dump())
    db.add(movie)
    db.commit()
    db.refresh(movie)
    return movie


@router.put("/{movie_id}", response_model=MovieOut, dependencies=[Depends(require_admin)])
def update_movie(movie_id: int, data: MovieUpdate, db: Session = Depends(get_db)):
    movie = db.get(Movie, movie_id)
    if movie is None:
        raise HTTPException(404, "Movie not found")
    for k, v in data.model_dump().items():
        setattr(movie, k, v)
    db.commit()
    db.refresh(movie)
    return movie


@router.delete("/{movie_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.get(Movie, movie_id)
    if movie is None:
        raise HTTPException(404, "Movie not found")
    db.delete(movie)
    db.commit()  # IntegrityError (existing bookings) -> 409 via global handler
