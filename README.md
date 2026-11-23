# SupplyChain — микросервисы, Traefik и API Gateway

В проекте четыре микросервиса:

- Supplier Service: Python / FastAPI, порт 8000 — PostgreSQL `supplier_db`.
- Order Service: Java 17 / Spring Boot WebFlux, порт 8081 — PostgreSQL `order_db`.
- Delivery Service: TypeScript / NestJS, порт 3000 — PostgreSQL `delivery_db`.
- Auth Service: Python / FastAPI, порт 3001 — PostgreSQL `wolf_auth`.

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

После запуска веб-интерфейс: http://localhost (через Traefik) или http://localhost:5173 (напрямую через Nginx).

## Логи

```bash
docker compose ps
docker compose logs -f postgres-order
docker compose logs -f order-service
```

## Traefik, Gateway и Request ID

Внешние запросы проходят через Traefik (`http://localhost`) в API Gateway, который маршрутизирует их к сервисам. Swagger UI на `http://localhost/swagger-ui.html` объединяет спецификации Order, Supplier, Delivery и Auth.

Gateway назначает UUID в заголовке `X-Request-ID`, если запрос не содержит допустимого значения, либо сохраняет переданный ID. Он передаётся микросервисам и возвращается в заголовке ответа; Order Service также передаёт его при HTTP-вызове Supplier Service.

Для ручной проверки:

```bash
curl -i http://localhost/api/suppliers \
  -H "X-Request-ID: demo-request-123"
```

## Database ownership

- Supplier Service владеет `supplier_db` (host port 5433).
- Order Service владеет `order_db` (host port 5434).
- Delivery Service владеет `delivery_db` (host port 5435).

## API Gateway

Spring Cloud Gateway доступен за Traefik на порту `80` (и напрямую на порту `8080` для локальной отладки):

| Gateway URL | Routed service | Internal path |
|---|---|---|
| `http://localhost:8080/api/orders` | Order Service | `/orders` |
| `http://localhost:8080/api/suppliers` | Supplier Service | `/suppliers` |
| `http://localhost:8080/api/products` | Supplier Service | `/products` |
| `http://localhost:8080/api/deliveries` | Delivery Service | `/api/deliveries` |

Gateway health: `http://localhost/actuator/health`.

Запустить или пересобрать стек из корня проекта:

```bash
docker compose up --build
```

## Wolf Auth Service — подключён

В проект добавлен backend из `wolf_auth-master/server`. Frontend и Nginx из исходного Wolf Auth не добавлялись: для SupplyChain нужен именно API-микросервис.

### Состав Auth Service

- FastAPI / Python 3.11, внутренний порт `3001`.
- Отдельная PostgreSQL 15, база `wolf_auth`.
- Отдельный Docker volume `auth-postgres-data`.
- Auth Service подключается к БД по внутреннему адресу `auth-postgres:5432`.
- Gateway обращается к Auth Service по `http://auth-service:3001`.

### Основные адреса

- Auth Swagger: http://localhost:3001/docs
- Auth health: http://localhost:3001/health
- Auth через Gateway: http://localhost:8080/auth/...
- Auth PostgreSQL на компьютере: `localhost:5440` (внутри Docker — `auth-postgres:5432`).

### Запуск

```bash
docker compose up --build
```

Compose сначала ждёт готовности четырёх PostgreSQL баз, затем запускает сервисы. Auth Service и его БД запускаются вместе с остальным проектом. Frontend/Nginx из Wolf Auth намеренно исключены, чтобы не конфликтовать с портами и не включать ненужный интерфейс.

### JWT

Исходный Auth Service подписывает токены алгоритмом `HS256`, помещает имя пользователя в claim `sub` и устанавливает `exp`. Gateway проверяет подпись и срок действия JWT.

`AUTH_JWT_SECRET` в корневом `.env` должен совпадать с `SECRET_KEY` Auth Service. В Compose он передаётся обоим контейнерам автоматически.

### API и вход

- `POST /auth/register` — регистрация, JSON с `username`, `email`, `password` и необязательным `telegram`.
- `POST /auth/login` — вход, **form URL-encoded**, поля `username` и `password`. В `username` можно передать email или username.
- `GET /users/me` — профиль текущего пользователя, нужен `Authorization: Bearer <token>`.

Пример входа через Gateway:

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=your-password"
```

Пример защищённого запроса:

```bash
curl http://localhost:8080/api/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Регистрация и вход доступны без токена. Бизнес API (`/api/**`) и защищённые Auth endpoint'ы требуют действительный JWT. Без токена или с недействительным/истёкшим токеном Gateway возвращает `401 Unauthorized`.

## Consul — Service Discovery

В проект добавлен Consul в режиме single-node development agent. Web UI доступен на
http://localhost:8500/ui.

### Регистрация сервисов

- `order-service` регистрируется в Consul автоматически через Spring Cloud Consul Discovery.
- `api-gateway` также регистрируется автоматически.
- `supplier-service`, `delivery-service` и `auth-service` регистрируются через
  декларативные service definitions в `infrastructure/consul/services.json`.
  Consul периодически проверяет их HTTP health endpoints.

### Маршрутизация через Gateway

Gateway использует `lb://...` URI и Spring Cloud LoadBalancer. Адреса экземпляров
берутся из Consul, а не задаются статически в `application.yml`.

- `lb://order-service`
- `lb://supplier-service`
- `lb://delivery-service`
- `lb://auth-service`

## Синхронное взаимодействие Order Service → Supplier Service

При создании заказа (`POST /api/orders` через Gateway) Order Service сначала
обращается к Supplier Service по HTTP:

`GET /products/{productId}/availability?quantity={quantity}`

Order Service находит Supplier Service через Consul и Spring Cloud LoadBalancer
(`http://supplier-service`), проверяет наличие нужного количества товара и только
после успешной проверки сохраняет заказ в собственной PostgreSQL.

### Надёжность HTTP-вызова

- Timeout: по умолчанию `2s` на попытку.
- Retry: до `3` попыток с паузой `300ms`; повторяются только сетевые ошибки,
  тайм-ауты и ответы Supplier Service `5xx`. Ответы `4xx` не повторяются.
- Circuit Breaker: окно из 10 вызовов, минимум 5 вызовов для расчёта,
  открытие при доле ошибок 50%, период OPEN — 10 секунд, затем HALF_OPEN.
- Когда Circuit Breaker открыт, Order Service возвращает `503`, не пытаясь
  обращаться к Supplier Service.

Настройки можно менять в `.env`:

```env
SUPPLIER_CLIENT_TIMEOUT=2s
SUPPLIER_RETRY_MAX_ATTEMPTS=3
SUPPLIER_RETRY_WAIT=300ms
```

## Kafka — асинхронное создание доставки

Добавлен Kafka broker в режиме KRaft (один узел для локальной разработки).
Order Service публикует событие `OrderCreated` в topic `orders.created`.
Delivery Service подписан на этот topic и автоматически создаёт доставку
в собственной PostgreSQL.

### Как работает сценарий

1. Клиент отправляет `POST /api/orders` через API Gateway.
2. Order Service синхронно проверяет наличие товара через Supplier Service.
3. Order Service сохраняет заказ и событие в таблицу `outbox_events` одной
   R2DBC-транзакцией.
4. Фоновый Outbox Publisher отправляет событие в Kafka и помечает его опубликованным.
5. Delivery Service получает событие и создаёт доставку.
6. Доставка доступна через `GET /api/deliveries/by-order/{orderId}`.

### Запуск

Из корневой папки проекта:

```bash
docker compose up --build
```

При первом запуске Docker соберёт Order и Delivery сервисы и поднимет Kafka.
В Kafka UI в этом учебном проекте нет; topic `orders.created` создаётся
автоматически при первой публикации.

## Реактивный сценарий: SSE + Kafka

Добавлен поток обновлений заказа через Server-Sent Events (SSE).

1. Клиент создаёт заказ через `POST /api/orders`.
2. Order Service сохраняет заказ и outbox-событие одной R2DBC-транзакцией.
3. Outbox Publisher отправляет `OrderCreated` в Kafka topic `orders.created`.
4. Delivery Service получает событие, создаёт доставку и публикует её статус
   в topic `deliveries.status.updated`.
5. Order Service получает событие статуса доставки через `@KafkaListener` и
   передаёт его подписанным SSE-клиентам через Spring WebFlux.
6. Изменения статуса через `PATCH /api/deliveries/{id}/status` также публикуются
   в Kafka и появляются в SSE-потоке заказа.

### Логи

```powershell
docker logs -f delivery-service
docker logs -f order-service
```

