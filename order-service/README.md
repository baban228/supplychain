# Order Service (Spring Boot WebFlux + PostgreSQL)

Port: `8081`  
Swagger UI: http://localhost:8081/swagger-ui.html  
Health: http://localhost:8081/actuator/health

The service uses Spring Data R2DBC, so database operations remain reactive
and do not block the WebFlux request threads.

## Run

From the repository root:

```bash
docker compose up --build
```

Docker Compose waits for `postgres-order` to become healthy before starting
`order-service`. The SQL schema is initialized from `src/main/resources/schema.sql`.

## Database

- Database: `order_db`
- Container: `postgres-order`
- Host port: `5434`
- Docker-network host: `postgres-order:5432`
- Persistent volume: `order-postgres-data`

## API

- `POST /orders`
- `GET /orders`
- `GET /orders/{id}`
- `PATCH /orders/{id}/status?status=CONFIRMED`
- `GET /orders/{id}/events`

The `events` endpoint is still a one-time current-state stream. It is not yet
a live event feed; Kafka-backed status events will be a later milestone.


## Build fix

`CreateOrderRequest` and `OrderDto` are nested records inside `OrderController`.
`OrderService` therefore references them with their enclosing class name:
`OrderController.CreateOrderRequest` and `OrderController.OrderDto`.
