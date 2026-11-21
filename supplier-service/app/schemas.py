from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SupplierCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    phone: str | None = None
    address: str = Field(min_length=2, max_length=500)


class SupplierOut(SupplierCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID


class ProductCreate(BaseModel):
    supplier_id: UUID
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    quantity: int = Field(ge=0)


class ProductOut(ProductCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    available: bool
