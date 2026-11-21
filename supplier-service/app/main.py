from contextlib import asynccontextmanager
from typing import Optional
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

# Первая учебная версия хранит данные в памяти процесса.
# На следующем этапе заменим репозиторий на PostgreSQL.
suppliers: dict[UUID, dict] = {}
products: dict[UUID, dict] = {}

class SupplierCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str
    phone: Optional[str] = None
    address: str

class ProductCreate(BaseModel):
    supplier_id: UUID
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = None
    price: float = Field(gt=0)
    quantity: int = Field(ge=0)

class SupplierOut(SupplierCreate):
    id: UUID

class ProductOut(ProductCreate):
    id: UUID
    available: bool

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Supplier Service starting")
    yield
    print("Supplier Service stopping")

app = FastAPI(
    title="Supplier Service",
    version="0.1.0",
    description="Поставщики, товары и проверка складских остатков",
    lifespan=lifespan,
)

@app.get("/health")
async def health():
    return {"status": "UP", "service": "supplier-service"}

@app.post("/suppliers", response_model=SupplierOut, status_code=201)
async def create_supplier(data: SupplierCreate):
    supplier_id = uuid4()
    record = {"id": supplier_id, **data.model_dump()}
    suppliers[supplier_id] = record
    return record

@app.get("/suppliers", response_model=list[SupplierOut])
async def list_suppliers():
    return list(suppliers.values())

@app.get("/suppliers/{supplier_id}", response_model=SupplierOut)
async def get_supplier(supplier_id: UUID):
    supplier = suppliers.get(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@app.post("/products", response_model=ProductOut, status_code=201)
async def create_product(data: ProductCreate):
    if data.supplier_id not in suppliers:
        raise HTTPException(status_code=404, detail="Supplier not found")
    product_id = uuid4()
    record = {
        "id": product_id,
        **data.model_dump(),
        "available": data.quantity > 0,
    }
    products[product_id] = record
    return record

@app.get("/products", response_model=list[ProductOut])
async def list_products(supplier_id: Optional[UUID] = Query(default=None)):
    result = list(products.values())
    if supplier_id:
        result = [p for p in result if p["supplier_id"] == supplier_id]
    return result

@app.get("/products/{product_id}", response_model=ProductOut)
async def get_product(product_id: UUID):
    product = products.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.get("/products/{product_id}/availability")
async def check_availability(product_id: UUID, quantity: int = Query(gt=0)):
    product = products.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return {
        "product_id": str(product_id),
        "available": product["quantity"] >= quantity,
        "requested_quantity": quantity,
        "available_quantity": product["quantity"],
        "unit_price": product["price"],
    }
