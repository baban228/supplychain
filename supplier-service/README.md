# Supplier Service (FastAPI + PostgreSQL)

Port: `8000`  
Swagger UI: http://localhost:8000/docs  
Health (includes DB check): http://localhost:8000/health

## Run with Docker Compose

From the repository root:

```bash
docker compose up --build
```

Compose starts PostgreSQL first and waits until its health check succeeds.
Supplier Service then connects to PostgreSQL and creates missing tables.

## API

- `POST /suppliers`
- `GET /suppliers`
- `GET /suppliers/{supplier_id}`
- `POST /products`
- `GET /products`
- `GET /products/{product_id}`
- `GET /products/{product_id}/availability?quantity=2`

## Important

Supplier data is now stored in PostgreSQL volume `supplier-postgres-data`.
Restarting containers does not delete the data. To intentionally delete the
database volume and all stored data, use:

```bash
docker compose down -v
```

Do not run that command if you want to preserve your test data.
