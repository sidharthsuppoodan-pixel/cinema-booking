from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Screen, Theatre
from app.schemas.theatre import TheatreCreate, TheatreDetail, TheatreOut, TheatreUpdate
from app.services.deps import require_admin
from app.services.serializers import screen_out, theatre_out

router = APIRouter(prefix="/theatres", tags=["Theatres"])


def _load(db: Session, theatre_id: int) -> Theatre:
    t = db.scalar(
        select(Theatre)
        .where(Theatre.id == theatre_id)
        .options(selectinload(Theatre.screens).selectinload(Screen.seats))
    )
    if t is None:
        raise HTTPException(404, "Theatre not found")
    return t


def _detail(t: Theatre) -> TheatreDetail:
    return TheatreDetail(**theatre_out(t).model_dump(), screens=[screen_out(s) for s in t.screens])


@router.get("", response_model=list[TheatreOut])
def list_theatres(
    city: str | None = Query(None, max_length=100),
    q: str | None = Query(None, max_length=100),
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    stmt = select(Theatre).options(selectinload(Theatre.screens))
    if not include_inactive:
        stmt = stmt.where(Theatre.is_active)
    if city:
        stmt = stmt.where(Theatre.city.ilike(city.strip()))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Theatre.name.ilike(like), Theatre.address.ilike(like), Theatre.city.ilike(like)))
    return [theatre_out(t) for t in db.scalars(stmt.order_by(Theatre.city, Theatre.name)).all()]


@router.get("/cities", response_model=list[str])
def list_cities(db: Session = Depends(get_db)):
    return db.scalars(select(Theatre.city).where(Theatre.is_active).distinct().order_by(Theatre.city)).all()


@router.get("/{theatre_id}", response_model=TheatreDetail)
def get_theatre(theatre_id: int, db: Session = Depends(get_db)):
    return _detail(_load(db, theatre_id))


@router.post("", response_model=TheatreDetail, status_code=201, dependencies=[Depends(require_admin)])
def create_theatre(data: TheatreCreate, db: Session = Depends(get_db)):
    t = Theatre(**data.model_dump())
    db.add(t)
    db.commit()
    return _detail(_load(db, t.id))


@router.put("/{theatre_id}", response_model=TheatreDetail, dependencies=[Depends(require_admin)])
def update_theatre(theatre_id: int, data: TheatreUpdate, db: Session = Depends(get_db)):
    t = _load(db, theatre_id)
    for k, v in data.model_dump().items():
        setattr(t, k, v)
    db.commit()
    return _detail(_load(db, theatre_id))


@router.delete("/{theatre_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_theatre(theatre_id: int, db: Session = Depends(get_db)):
    t = db.get(Theatre, theatre_id)
    if t is None:
        raise HTTPException(404, "Theatre not found")
    db.delete(t)
    db.commit()
