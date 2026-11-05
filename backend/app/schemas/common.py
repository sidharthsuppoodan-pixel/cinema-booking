from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, PlainSerializer, StringConstraints

T = TypeVar("T")

# Decimals are serialised as JSON numbers for the frontend.
Money = Annotated[float, PlainSerializer(lambda v: round(float(v), 2), return_type=float)]

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class Message(BaseModel):
    detail: str
