# SupplyChain — три бизнес-сервиса, отдельные базы данных и API Gateway

В проекте три бизнес-сервиса:

- Supplier Service: Python / FastAPI, порт 8000 — PostgreSQL `supplier_db`.
- Order Service: Java 17 / Spring Boot WebFlux, порт 8081 — PostgreSQL `order_db`.
- Delivery Service: TypeScript / NestJS, порт 3000 — PostgreSQL `delivery_db`.

## Что добавлено на этом этапе

Order Service использует Spring Data R2DBC и отдельный PostgreSQL. R2DBC сохраняет реактивную модель WebFlux, не переводя запросы к базе на блокирующий JDBC. Таблица `orders` создаётся из `order-service/src/main/resources/schema.sql` при старте.

Каждая база имеет собственный Docker volume:

- `supplier-postgres-data` — данные Supplier Service.
- `order-postgres-data` — данные Order Service.
- `delivery-postgres-data` — данные Delivery Service.

Сервисы не обращаются напрямую к таблицам друг друга.

## Запуск

Из корня проекта:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Если `.env` уже создан на предыдущем этапе, проверь, что в нём есть переменные для всех трёх баз данных.

## Проверка

- Supplier Swagger: http://localhost:8000/docs
- Supplier health: http://localhost:8000/health
- Order Swagger: http://localhost:8081/swagger-ui.html
- Order health (включая состояние БД): http://localhost:8081/actuator/health
- Delivery Swagger: http://localhost:3000/docs
- Delivery health: http://localhost:3000/api/deliveries/health

Порты PostgreSQL на компьютере: Supplier — `localhost:5433`, Order — `localhost:5434`, Delivery — `localhost:5435`. Внутри Docker каждый сервис подключается к своей базе по имени контейнера.

## Тест сохранения заказов

1. В Swagger Order Service выполни `POST /orders`.
2. Скопируй возвращённый `id`.
3. Выполни `GET /orders/{id}` и убедись, что заказ найден.
4. Выполни `docker compose down` (без `-v`).
5. Запусти `docker compose up` снова.
6. Повтори `GET /orders/{id}` — заказ должен сохраниться.

**Не используй `docker compose down -v`, если хочешь сохранить данные:** флаг `-v` удаляет volumes.

## Логи

```bash
docker compose ps
docker compose logs -f postgres-order
docker compose logs -f order-service
```

## Что ещё не реализовано

Пока не реализованы Kafka, Consul, Traefik, интеграция с Auth Service, межсервисные HTTP-вызовы, Circuit Breaker, идемпотентность, Outbox и полноценный SSE-поток. API Gateway добавлен на этом этапе и пока выполняет маршрутизацию без проверки JWT.

Учебные пароли из `.env.example` предназначены только для локального запуска.


## Database ownership

- Supplier Service owns `supplier_db` (host port 5433).
- Order Service owns `order_db` (host port 5434).
- Delivery Service owns `delivery_db` (host port 5435).

Do not let one service query another service's database directly. Inter-service
communication will be implemented through HTTP and Kafka in later milestones.

## API Gateway

The project includes a Spring Cloud Gateway service on port `8080`. It is the single HTTP entry point for the business APIs:

| Gateway URL | Routed service | Internal path |
|---|---|---|
| `http://localhost:8080/api/orders` | Order Service | `/orders` |
| `http://localhost:8080/api/suppliers` | Supplier Service | `/suppliers` |
| `http://localhost:8080/api/products` | Supplier Service | `/products` |
| `http://localhost:8080/api/deliveries` | Delivery Service | `/api/deliveries` |

Gateway health: `http://localhost:8080/actuator/health`.

Start or rebuild the stack from the project root:

```bash
docker compose up --build
```

At this stage Gateway performs routing only. JWT validation / Auth Service integration will be added in a separate step. The individual services and their Swagger pages remain directly accessible during development.
