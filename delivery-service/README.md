# Delivery Service (NestJS + PostgreSQL)

Port: `3000`  
Swagger UI: http://localhost:3000/docs  
Health (includes DB check): http://localhost:3000/api/deliveries/health

Delivery Service uses TypeORM with PostgreSQL. The database is independent:
`delivery_db`, container `postgres-delivery`, host port `5435`, volume
`delivery-postgres-data`.

## Run

From the repository root:

```bash
docker compose up --build
```

Docker Compose waits for PostgreSQL to become healthy before starting this service.
TypeORM creates the table from the entity at startup (`synchronize: true`).
This is suitable for a local learning project; before production, replace
automatic synchronization with database migrations.

## API

- `POST /api/deliveries`
- `GET /api/deliveries`
- `GET /api/deliveries/by-order/{orderId}`
- `GET /api/deliveries/{id}`
- `PATCH /api/deliveries/{id}/status?status=IN_TRANSIT`
- `GET /api/deliveries/health`
