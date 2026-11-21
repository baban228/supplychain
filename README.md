# SupplyChain — first milestone

This starter contains three independently runnable business services:

- Supplier Service: Python / FastAPI, port 8000
- Order Service: Java 17 / Spring Boot WebFlux, port 8081
- Delivery Service: TypeScript / NestJS, port 3000

## Important scope note

This is an API-first learning milestone. All three services currently keep data
in process memory. Data is lost when a service restarts. PostgreSQL, Kafka,
Consul, API Gateway, Traefik, Auth integration, inter-service resilience,
durable event history and the Outbox pattern are intentionally not included yet.
We add and test those one at a time.

## Run all three containers

```bash
docker compose up --build
```

## Run separately

Supplier:
```bash
cd supplier-service
python -m venv .venv
# activate venv, then:
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Order:
```bash
cd order-service
mvn spring-boot:run
```

Delivery:
```bash
cd delivery-service
npm install
npm run start:dev
```

## API documentation

- Supplier: http://localhost:8000/docs
- Order: http://localhost:8081/swagger-ui.html
- Delivery: http://localhost:3000/docs

## Health endpoints

- GET http://localhost:8000/health
- GET http://localhost:8081/actuator/health
- GET http://localhost:3000/api/deliveries/health

## Suggested test order

1. Check all three health endpoints.
2. Create a supplier in Supplier Service.
3. Create a product for that supplier.
4. Check product availability.
5. Create an order in Order Service (first version does not yet call Supplier).
6. Create a delivery in Delivery Service.
7. Change delivery status.

See each service README for details.
