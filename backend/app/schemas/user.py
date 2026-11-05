import re
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator

from app.models.enums import UserRole
from app.schemas.common import ORMModel

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)]
PHONE_RE = re.compile(r"^\+?[0-9 ()-]{7,20}$")


def _check_phone(v: str | None) -> str | None:
    if v in (None, ""):
        return None
    if not PHONE_RE.match(v):
        raise ValueError("Enter a valid phone number")
    return v


def _check_password(v: str) -> str:
    if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("Password must contain at least one letter and one number")
    return v


class UserRegister(BaseModel):
    full_name: Name
    email: EmailStr
    phone: Phone | None = None
    password: str = Field(min_length=8, max_length=64)

    _phone = field_validator("phone")(_check_phone)
    _pw = field_validator("password")(_check_password)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()


class LoginRequest(BaseModel):
    # Plain string: login only needs to match an existing account, and the
    # bootstrap admin may use an internal domain such as *.local.
    email: Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=3, max_length=255)]
    password: str = Field(min_length=1, max_length=64)


class UserOut(ORMModel):
    id: int
    full_name: str
    email: str
    phone: str | None
    role: UserRole
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    full_name: Name | None = None
    phone: Phone | None = None
    current_password: str | None = Field(default=None, max_length=64)
    new_password: str | None = Field(default=None, min_length=8, max_length=64)

    _phone = field_validator("phone")(_check_phone)

    @field_validator("new_password")
    @classmethod
    def pw(cls, v: str | None) -> str | None:
        return None if v is None else _check_password(v)


class AdminUserUpdate(BaseModel):
    full_name: Name | None = None
    email: EmailStr | None = None
    phone: Phone | None = None
    is_active: bool | None = None
    role: UserRole | None = None

    _phone = field_validator("phone")(_check_phone)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str | None) -> str | None:
        return v.lower() if v else v


class CustomerOut(UserOut):
    booking_count: int = 0
    total_spent: float = 0
