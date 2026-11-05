from enum import Enum


class StrEnum(str, Enum):
    def __str__(self) -> str:  # pragma: no cover
        return self.value

    @classmethod
    def values(cls) -> list[str]:
        return [m.value for m in cls]

    @classmethod
    def sql_in(cls) -> str:
        return ", ".join(f"'{v}'" for v in cls.values())


class UserRole(StrEnum):
    ADMIN = "admin"
    CUSTOMER = "customer"


class SeatCategory(StrEnum):
    STANDARD = "STANDARD"
    PREMIUM = "PREMIUM"
    RECLINER = "RECLINER"


class ScreenType(StrEnum):
    TWO_D = "2D"
    THREE_D = "3D"
    IMAX = "IMAX"
    FOUR_DX = "4DX"


class BookingStatus(StrEnum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class PaymentStatus(StrEnum):
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED"


class PaymentMethod(StrEnum):
    CARD = "CARD"
    UPI = "UPI"
    NET_BANKING = "NET_BANKING"
    WALLET = "WALLET"
    CASH = "CASH"
