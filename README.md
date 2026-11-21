# SupplyChain — milestone 2: Supplier Service + PostgreSQL

This starter contains three independently runnable business services:

- Supplier Service: Python / FastAPI, port 8000 — now uses PostgreSQL
- Order Service: Java 17 / Spring Boot WebFlux, port 8081 — still in-memory
- Delivery Service: TypeScript / NestJS, port 3000 — still in-memory

## Current scope

PostgreSQL is connected only to Supplier Service in this milestone.
The database runs in Docker as `postgres-supplier`; its data is persisted
in the `supplier-postgres-data` volume. Order and Delivery are intentionally
unchanged and still keep data in process memory.

Kafka, Consul, API Gateway, Traefik, Auth integration, inter-service
resilience, durable event history and the Outbox pattern are not included yet.
We add and test those one at a time.

## First run

Copy `.env.example` to `.env` (optional for local defaults; recommended):

```bash
cp .env.example .env
docker compose up --build
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

## Check containers

```bash
docker compose ps
docker compose logs -f postgres-supplier
docker compose logs -f supplier-service
```

## API documentation and health

- Supplier Swagger: http://localhost:8000/docs
- Supplier health (also checks DB): http://localhost:8000/health
- Order Swagger: http://localhost:8081/swagger-ui.html
- Order health: http://localhost:8081/actuator/health
- Delivery Swagger: http://localhost:3000/docs
- Delivery health: http://localhost:3000/api/deliveries/health

## Test persistence

1. Open Supplier Swagger and create a supplier (`POST /suppliers`).
2. Create a product linked to that supplier (`POST /products`).
3. Read them back with `GET /suppliers` and `GET /products`.
4. Stop the containers with `docker compose down` (do not add `-v`).
5. Start again with `docker compose up`.
6. Read the lists again. The supplier and product should still exist.

## Database connection

Inside Docker, Supplier Service connects to:
`postgres-supplier:5432/supplier_db`

From the host machine, PostgreSQL is exposed at:
`localhost:5433`

The local development credentials are in `.env.example`. Do not use them
outside a local learning environment.

See `supplier-service/README.md` for service-specific details.
