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

Скопируй `.env.example` в `.env` (если `.env` уже есть, добавь в него все переменные `AUTH_*`) и выполни из корня:

```bash
docker compose up --build
```

Compose сначала ждёт готовности четырёх PostgreSQL баз, затем запускает сервисы. Auth Service и его БД запускаются вместе с остальным проектом. Frontend/Nginx из Wolf Auth намеренно исключены, чтобы не конфликтовать с портами и не включать ненужный интерфейс.

### JWT

Исходный Auth Service подписывает токены алгоритмом `HS256`, помещает имя пользователя в claim `sub` и устанавливает `exp`. Gateway проверяет подпись и срок действия JWT.

`AUTH_JWT_SECRET` в корневом `.env` должен совпадать с `SECRET_KEY` Auth Service. В Compose он передаётся обоим контейнерам автоматически. Пример в `.env.example` предназначен только для локальной разработки; замени его случайным секретом длиной не менее 32 UTF-8 байт. Не публикуй `.env` в Git.

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

### Проверка и логи

```bash
docker compose ps
docker compose logs -f auth-postgres
docker compose logs -f auth-service
docker compose logs -f api-gateway
```

Для остановки без удаления данных:

```bash
docker compose down
```

Не используй `docker compose down -v`, если хочешь сохранить данные PostgreSQL: эта команда удаляет volumes.

### Важные замечания

- Auth Service владеет только своей базой `wolf_auth`; другие сервисы не должны обращаться к ней напрямую.
- Проверка JWT выполняется на Gateway. При текущем учебном режиме бизнес-порты доступны только на `127.0.0.1`; для production следует дополнительно закрыть прямой доступ к сервисам и БД.
- В проекте пока не настроено разграничение по ролям/permissions для операций SupplyChain — сейчас проверяется подлинность и срок действия токена.
- Исходный Auth Service создаёт таблицы при старте через `Base.metadata.create_all`; миграции Alembic в исходном проекте не настроены.


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

### Проверка

1. Запусти из корня проекта:

   ```bash
   docker compose up --build
   ```

2. Открой Consul UI: http://localhost:8500/ui.
3. Перейди в **Services**. Должны отображаться `api-gateway`, `order-service`,
   `supplier-service`, `delivery-service` и `auth-service`.
4. Убедись, что у сервисов статус **passing**.
5. Проверь API через Gateway:

   - `http://localhost:8080/api/orders`
   - `http://localhost:8080/api/suppliers`
   - `http://localhost:8080/api/products`
   - `http://localhost:8080/api/deliveries`
   - `http://localhost:8080/auth/...`

### Важные замечания

- Consul используется как реестр и health-check механизм. Python/NestJS/Auth сервисы
  регистрируются конфигурацией Consul, без добавления Consul SDK в их исходный код.
- Для реального production окружения вместо `-dev` нужно настроить полноценный
  Consul cluster, ACL, TLS и устойчивое хранилище.
- `consul-data` — отдельный volume. Не используй `docker compose down -v`, если
  хочешь сохранить volumes PostgreSQL и Consul.
