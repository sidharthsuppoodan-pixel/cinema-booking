import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Booking, Movie, Payment, Screen, Showtime, Theatre, User
from app.models.enums import BookingStatus, PaymentStatus, UserRole
from app.routes.bookings import BOOKING_LOAD, load_booking
from app.schemas.booking import BookingOut, BookingStatusUpdate, CancelRequest
from app.schemas.common import Money, Page
from app.schemas.user import AdminUserUpdate, CustomerOut
from app.services import booking_service
from app.services.booking_service import utcnow
from app.services.deps import require_admin
from app.services.serializers import booking_out

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


# ------------------------------------------------------------------ stats
class DailyPoint(BaseModel):
    date: str
    bookings: int
    revenue: Money


class TopMovie(BaseModel):
    movie_id: int
    title: str
    tickets: int
    revenue: Money


class Stats(BaseModel):
    total_movies: int
    active_movies: int
    total_theatres: int
    total_screens: int
    upcoming_showtimes: int
    total_bookings: int
    confirmed_bookings: int
    cancelled_bookings: int
    total_customers: int
    tickets_sold: int
    gross_revenue: Money
    refunds: Money
    net_revenue: Money
    daily: list[DailyPoint]
    top_movies: list[TopMovie]
    recent_bookings: list[BookingOut]


@router.get("/stats", response_model=Stats)
def stats(db: Session = Depends(get_db)):
    count = lambda stmt: db.scalar(stmt) or 0  # noqa: E731
    gross = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.status.in_(
                [PaymentStatus.PAID.value, PaymentStatus.REFUNDED.value, PaymentStatus.PARTIALLY_REFUNDED.value]
            )
        )
    ) or Decimal(0)
    refunds = db.scalar(select(func.coalesce(func.sum(Payment.refund_amount), 0))) or Decimal(0)

    since = utcnow() - timedelta(days=6)
    day = func.date_trunc("day", func.timezone(settings.app_timezone, Booking.created_at))
    daily_rows = db.execute(
        select(
            day.label("d"),
            func.count(Booking.id),
            func.coalesce(
                func.sum(case((Booking.status != BookingStatus.CANCELLED.value, Booking.total_amount), else_=0)), 0
            ),
        )
        .where(Booking.created_at >= since.replace(hour=0, minute=0, second=0, microsecond=0))
        .group_by("d")
        .order_by("d")
    ).all()
    by_day = {r[0].date().isoformat(): (r[1], r[2]) for r in daily_rows}
    from zoneinfo import ZoneInfo

    today = utcnow().astimezone(ZoneInfo(settings.app_timezone)).date()
    daily = []
    for i in range(6, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        b, rev = by_day.get(d, (0, 0))
        daily.append(DailyPoint(date=d, bookings=b, revenue=rev))

    top_rows = db.execute(
        select(Movie.id, Movie.title, func.sum(Booking.seat_count), func.sum(Booking.subtotal))
        .join(Showtime, Showtime.movie_id == Movie.id)
        .join(Booking, Booking.showtime_id == Showtime.id)
        .where(Booking.status != BookingStatus.CANCELLED.value)
        .group_by(Movie.id, Movie.title)
        .order_by(func.sum(Booking.seat_count).desc())
        .limit(5)
    ).all()

    recent = db.scalars(select(Booking).options(*BOOKING_LOAD).order_by(Booking.created_at.desc()).limit(6)).unique().all()

    return Stats(
        total_movies=count(select(func.count(Movie.id))),
        active_movies=count(select(func.count(Movie.id)).where(Movie.is_active)),
        total_theatres=count(select(func.count(Theatre.id))),
        total_screens=count(select(func.count(Screen.id))),
        upcoming_showtimes=count(
            select(func.count(Showtime.id)).where(Showtime.start_time > utcnow(), Showtime.is_active)
        ),
        total_bookings=count(select(func.count(Booking.id))),
        confirmed_bookings=count(
            select(func.count(Booking.id)).where(Booking.status == BookingStatus.CONFIRMED.value)
        ),
        cancelled_bookings=count(
            select(func.count(Booking.id)).where(Booking.status == BookingStatus.CANCELLED.value)
        ),
        total_customers=count(select(func.count(User.id)).where(User.role == UserRole.CUSTOMER.value)),
        tickets_sold=count(
            select(func.coalesce(func.sum(Booking.seat_count), 0)).where(
                Booking.status != BookingStatus.CANCELLED.value
            )
        ),
        gross_revenue=gross,
        refunds=refunds,
        net_revenue=Decimal(gross) - Decimal(refunds),
        daily=daily,
        top_movies=[TopMovie(movie_id=r[0], title=r[1], tickets=r[2] or 0, revenue=r[3] or 0) for r in top_rows],
        recent_bookings=[booking_out(b) for b in recent],
    )


# --------------------------------------------------------------- bookings
@router.get("/bookings", response_model=Page[BookingOut])
def list_bookings(
    q: str | None = Query(None, max_length=100),
    status: BookingStatus | None = None,
    payment_status: PaymentStatus | None = None,
    showtime_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Booking)
        .join(Booking.user)
        .join(Booking.showtime)
        .join(Showtime.movie)
        .outerjoin(Booking.payment)
    )
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Booking.booking_code.ilike(like),
                User.email.ilike(like),
                User.full_name.ilike(like),
                Movie.title.ilike(like),
            )
        )
    if status:
        stmt = stmt.where(Booking.status == status.value)
    if payment_status:
        stmt = stmt.where(Payment.status == payment_status.value)
    if showtime_id:
        stmt = stmt.where(Booking.showtime_id == showtime_id)
    total = db.scalar(select(func.count()).select_from(stmt.with_only_columns(Booking.id).subquery())) or 0
    rows = db.scalars(
        stmt.options(*BOOKING_LOAD)
        .order_by(Booking.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).unique().all()
    return Page(items=[booking_out(b) for b in rows], total=total, page=page, page_size=page_size)


@router.get("/bookings/{code}", response_model=BookingOut)
def admin_get_booking(code: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    b = load_booking(db, code)
    return booking_out(b, booking_service.cancellation_quote(b, admin))


@router.patch("/bookings/{code}", response_model=BookingOut)
def admin_update_booking(
    code: str, data: BookingStatusUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    b = load_booking(db, code)
    booking_service.admin_update_status(db, b, admin, data.status, data.payment_status, data.reason)
    b = load_booking(db, code)
    return booking_out(b, booking_service.cancellation_quote(b, admin))


@router.post("/bookings/{code}/cancel", response_model=BookingOut)
def admin_cancel_booking(
    code: str,
    data: CancelRequest | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    b = load_booking(db, code)
    booking_service.cancel_booking(db, b, admin, data.reason if data else None)
    b = load_booking(db, code)
    return booking_out(b, booking_service.cancellation_quote(b, admin))


# -------------------------------------------------------------- customers
class CustomerDetail(BaseModel):
    customer: CustomerOut
    bookings: list[BookingOut]


def _customer_query():
    spent = func.coalesce(
        func.sum(case((Booking.status != BookingStatus.CANCELLED.value, Booking.total_amount), else_=0)), 0
    )
    return (
        select(User, func.count(Booking.id), spent)
        .outerjoin(Booking, Booking.user_id == User.id)
        .group_by(User.id)
    )


def _customer_out(row) -> CustomerOut:
    user, cnt, spent = row
    return CustomerOut(**CustomerOut.model_validate(user).model_dump(exclude={"booking_count", "total_spent"}),
                       booking_count=cnt, total_spent=float(spent))


@router.get("/customers", response_model=Page[CustomerOut])
def list_customers(
    q: str | None = Query(None, max_length=100),
    role: UserRole | None = UserRole.CUSTOMER,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    base = select(User.id)
    if role:
        base = base.where(User.role == role.value)
    if q:
        like = f"%{q.strip()}%"
        base = base.where(or_(User.full_name.ilike(like), User.email.ilike(like), User.phone.ilike(like)))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.execute(
        _customer_query()
        .where(User.id.in_(base))
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return Page(items=[_customer_out(r) for r in rows], total=total, page=page, page_size=page_size)


@router.get("/customers/{user_id}", response_model=CustomerDetail)
def get_customer(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = db.execute(_customer_query().where(User.id == user_id)).first()
    if row is None:
        raise HTTPException(404, "Customer not found")
    bookings = db.scalars(
        select(Booking).where(Booking.user_id == user_id).options(*BOOKING_LOAD).order_by(Booking.created_at.desc())
    ).unique().all()
    return CustomerDetail(customer=_customer_out(row), bookings=[booking_out(b) for b in bookings])


@router.put("/customers/{user_id}", response_model=CustomerOut)
def update_customer(
    user_id: int, data: AdminUserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Customer not found")
    if user.id == admin.id and (data.is_active is False or (data.role and data.role != UserRole.ADMIN)):
        raise HTTPException(400, "You cannot deactivate or demote your own account")
    if data.email and data.email != user.email:
        if db.scalar(select(User.id).where(User.email == data.email)):
            raise HTTPException(409, "Another account already uses this email")
    for field in data.model_fields_set:
        value = getattr(data, field)
        if field in ("full_name", "email", "is_active", "role") and value is None:
            continue
        setattr(user, field, value.value if field == "role" else value)
    db.commit()
    return _customer_out(db.execute(_customer_query().where(User.id == user_id)).first())


@router.delete("/customers/{user_id}", status_code=204)
def delete_customer(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Customer not found")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot delete your own account")
    db.delete(user)
    db.commit()


# ---------------------------------------------------------------- uploads
ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAGIC = {".jpg": [b"\xff\xd8\xff"], ".png": [b"\x89PNG\r\n\x1a\n"], ".webp": [b"RIFF"]}


class UploadResult(BaseModel):
    url: str


@router.post("/uploads/poster", response_model=UploadResult, status_code=201)
async def upload_poster(file: UploadFile = File(...)):
    ext = ALLOWED.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Only JPEG, PNG or WEBP images are allowed")
    limit = settings.max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"Image is larger than {settings.max_upload_mb} MB")
    if not any(data.startswith(m) for m in MAGIC[ext]):
        raise HTTPException(400, "File content does not match its image type")
    target_dir = Path(settings.media_dir) / "posters"
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (target_dir / name).write_bytes(data)
    return UploadResult(url=f"{settings.media_url_prefix}/posters/{name}")
