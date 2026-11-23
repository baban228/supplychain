from contextlib import asynccontextmanager
import re
from typing import Optional
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from . import models
from .schemas import ProductCreate, ProductOut, SupplierCreate, SupplierOut


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Учебный вариант: создаём отсутствующие таблицы при старте.
    # Для реальных production-изменений схемы позже подключим Alembic.
    Base.metadata.create_all(bind=engine)
    print("Supplier Service connected to PostgreSQL; tables are ready")
    yield
    print("Supplier Service stopping")


app = FastAPI(
    title="Supplier Service",
    version="0.2.0",
    description="Поставщики, товары и проверка складских остатков",
    lifespan=lifespan,
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", "")
    if not re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", request_id):
        request_id = str(uuid4())

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.get("/gateway-openapi.json", include_in_schema=False)
def gateway_openapi():
    schema = {**app.openapi(), "servers": [{"url": "/api"}]}
    return JSONResponse(schema)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "UP", "service": "supplier-service", "database": "UP"}
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "DOWN",
                "service": "supplier-service",
                "database": "DOWN",
            },
        )


@app.post("/suppliers", response_model=SupplierOut, status_code=201)
def create_supplier(data: SupplierCreate, db: Session = Depends(get_db)):
    supplier = models.Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@app.get("/suppliers", response_model=list[SupplierOut])
def list_suppliers(db: Session = Depends(get_db)):
    return db.scalars(select(models.Supplier).order_by(models.Supplier.name)).all()


@app.get("/suppliers/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: UUID, db: Session = Depends(get_db)):
    supplier = db.get(models.Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@app.post("/products", response_model=ProductOut, status_code=201)
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    supplier = db.get(models.Supplier, data.supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")

    product = models.Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@app.get("/products", response_model=list[ProductOut])
def list_products(
    supplier_id: Optional[UUID] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = select(models.Product).order_by(models.Product.name)
    if supplier_id is not None:
        query = query.where(models.Product.supplier_id == supplier_id)
    return db.scalars(query).all()


@app.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: UUID, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.get("/products/{product_id}/availability")
def check_availability(
    product_id: UUID,
    quantity: int = Query(gt=0),
    db: Session = Depends(get_db),
):
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return {
        "product_id": str(product_id),
        "available": product.quantity >= quantity,
        "requested_quantity": quantity,
        "available_quantity": product.quantity,
        "unit_price": product.price,
    }
