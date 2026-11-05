from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.models.enums import BookingStatus, PaymentMethod, PaymentStatus
from app.schemas.common import Money, ORMModel


class BookingCreate(BaseModel):
    showtime_id: int
    seat_ids: list[int] = Field(min_length=1, max_length=20)
    payment_method: PaymentMethod

    @field_validator("seat_ids")
    @classmethod
    def unique(cls, v: list[int]) -> list[int]:
        if len(set(v)) != len(v):
            raise ValueError("Duplicate seats in request")
        return v

    @field_validator("payment_method")
    @classmethod
    def online_only(cls, v: PaymentMethod) -> PaymentMethod:
        if v == PaymentMethod.CASH:
            raise ValueError("Cash payments are only available at the box office")
        return v


class CancelRequest(BaseModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus | None = None
    payment_status: PaymentStatus | None = None
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class BookingSeatOut(ORMModel):
    seat_id: int
    seat_label: str
    category: str
    price: Money
    is_active: bool


class PaymentOut(ORMModel):
    id: int
    amount: Money
    refund_amount: Money
    method: PaymentMethod
    status: PaymentStatus
    transaction_ref: str
    paid_at: datetime | None


class CancellationQuote(BaseModel):
    cancellable: bool
    reason: str
    refund_percent: float
    refund_amount: Money
    hours_to_show: float


class BookingOut(BaseModel):
    id: int
    booking_code: str
    status: BookingStatus
    seat_count: int
    subtotal: Money
    convenience_fee: Money
    total_amount: Money
    created_at: datetime
    cancelled_at: datetime | None
    cancellation_reason: str | None
    seats: list[BookingSeatOut]
    payment: PaymentOut | None
    # Denormalised details for display
    showtime_id: int
    start_time: datetime
    end_time: datetime
    movie_id: int
    movie_title: str
    movie_poster_url: str | None
    movie_certificate: str | None
    language: str | None
    theatre_name: str
    theatre_address: str
    theatre_city: str
    screen_name: str
    screen_type: str
    customer_id: int
    customer_name: str
    customer_email: str
    customer_phone: str | None
    cancellation: CancellationQuote | None = None
