# SupplyChain — следующий этап: отдельные базы для Supplier и Order

В проекте три бизнес-сервиса:

- Supplier Service: Python / FastAPI, порт 8000 — PostgreSQL `supplier_db`.
- Order Service: Java 17 / Spring Boot WebFlux, порт 8081 — PostgreSQL `order_db`.
- Delivery Service: TypeScript / NestJS, порт 3000 — пока хранит данные в памяти.

## Что добавлено на этом этапе

Order Service использует Spring Data R2DBC и отдельный PostgreSQL. R2DBC сохраняет реактивную модель WebFlux, не переводя запросы к базе на блокирующий JDBC. Таблица `orders` создаётся из `order-service/src/main/resources/schema.sql` при старте.

Каждая база имеет собственный Docker volume:

- `supplier-postgres-data` — данные Supplier Service.
- `order-postgres-data` — данные Order Service.

Сервисы не обращаются напрямую к таблицам друг друга.

## Запуск

Из корня проекта:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Если `.env` уже создан на предыдущем этапе, просто проверь, что в нём есть `ORDER_DB_USER` и `ORDER_DB_PASSWORD`.

## Проверка

- Supplier Swagger: http://localhost:8000/docs
- Supplier health: http://localhost:8000/health
- Order Swagger: http://localhost:8081/swagger-ui.html
- Order health (включая состояние БД): http://localhost:8081/actuator/health
- Delivery Swagger: http://localhost:3000/docs
- Delivery health: http://localhost:3000/api/deliveries/health

Порты PostgreSQL на компьютере: Supplier — `localhost:5433`, Order — `localhost:5434`. Внутри Docker Order Service подключается к `postgres-order:5432/order_db`.

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

Delivery Service пока использует память. Kafka, Consul, API Gateway, Traefik, интеграция с Auth Service, межсервисные HTTP-вызовы, Circuit Breaker, идемпотентность, Outbox и полноценный SSE-поток будут отдельными следующими этапами.

Учебные пароли из `.env.example` предназначены только для локального запуска.
