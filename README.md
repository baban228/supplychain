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


## Синхронное взаимодействие Order Service → Supplier Service

При создании заказа (`POST /api/orders` через Gateway) Order Service сначала
обращается к Supplier Service по HTTP:

`GET /products/{productId}/availability?quantity={quantity}`

Order Service находит Supplier Service через Consul и Spring Cloud LoadBalancer
(`http://supplier-service`), проверяет наличие нужного количества товара и только
после успешной проверки сохраняет заказ в собственной PostgreSQL.

Результаты проверки:

- Товар существует и остатка достаточно — заказ сохраняется со статусом `CREATED`.
- Товар не найден — API возвращает `404`.
- Остатка недостаточно — API возвращает `409 Conflict`, заказ не создаётся.
- Supplier Service временно недоступен — API возвращает `503 Service Unavailable`.

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

### Проверка сценария

1. Открой Supplier Swagger: http://localhost:8000/docs.
2. Создай поставщика через `POST /suppliers`, сохрани его `id`.
3. Создай товар через `POST /products`, укажи сохранённый `supplier_id`,
   `price` и `quantity`, например `10`.
4. Сохрани `id` созданного товара.
5. Открой Gateway и создай заказ через `POST /api/orders`:

```json
{
  "customerId": "customer-001",
  "productId": "UUID_СОЗДАННОГО_ТОВАРА",
  "quantity": 2,
  "deliveryAddress": "Riga, Latvia"
}
```

Передавай `Authorization: Bearer <JWT>`.

6. Повтори запрос с `quantity` больше складского остатка — ожидается `409`,
   и новый заказ не должен появиться в Order Service.
7. Укажи несуществующий UUID товара — ожидается `404`.

### Демонстрация отказоустойчивости

Для учебной проверки можно временно остановить Supplier Service:

```bash
docker compose stop supplier-service
```

Затем несколько раз отправить `POST /api/orders`. После сетевых повторов
Circuit Breaker должен перейти в OPEN, а Order Service — отвечать `503`.
Верни сервис:

```bash
docker compose start supplier-service
```

После периода OPEN Circuit Breaker перейдёт в HALF_OPEN и сможет восстановить
соединение. Для полного сброса состояния можно перезапустить Order Service:

```bash
docker compose restart order-service
```

**Важно:** этот этап проверяет наличие товара, но пока не резервирует и не уменьшает
складской остаток. Защиту от гонок и атомарное резервирование добавим отдельным
этапом вместе с событиями Kafka/Outbox.


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

Outbox нужен, чтобы не потерять событие, если процесс Order Service завершится
между сохранением заказа и отправкой в Kafka. Если публикация прошла, но отметка
`published` не сохранилась, событие может быть отправлено повторно — consumer
защищён от дубликатов уникальным индексом по `order_id` и проверкой существующей
записи.

### Запуск

Из корневой папки проекта:

```bash
docker compose up --build
```

При первом запуске Docker соберёт Order и Delivery сервисы и поднимет Kafka.
В Kafka UI в этом учебном проекте нет; topic `orders.created` создаётся
автоматически при первой публикации.

### Проверка

1. Убедись, что все контейнеры запущены:

   ```bash
   docker compose ps
   docker compose logs -f kafka
   ```

2. Создай заказ через `POST http://localhost:8080/api/orders` (JWT обязателен):

   ```json
   {
     "customerId": "customer-001",
     "productId": "UUID_СУЩЕСТВУЮЩЕГО_ТОВАРА",
     "quantity": 2,
     "deliveryAddress": "Riga, Latvia"
   }
   ```

3. Из ответа скопируй `id` заказа.
4. Подожди 1–3 секунды и запроси:

   ```http
   GET http://localhost:8080/api/deliveries/by-order/ORDER_ID
   Authorization: Bearer YOUR_ACCESS_TOKEN
   ```

   Должна появиться доставка со статусом `CREATED`.

5. Проверь логи:

   ```bash
   docker compose logs -f order-service
   docker compose logs -f delivery-service
   ```

   В Order Service появится сообщение о публикации Outbox event, в Delivery Service —
   о получении `OrderCreated`.

### Проверка идемпотентности

Повтори получение/обработку одного и того же события (например, перезапусти
Delivery Service после того, как Kafka сохранила сообщение, или повторно отправь
тестовое событие с тем же `orderId`). В `deliveries` должна остаться одна запись
для данного заказа. Kafka работает с доставкой сообщений как минимум один раз;
уникальный индекс БД гарантирует отсутствие повторной доставки для одного заказа.

### Важные замечания

- Order Service не подключается напрямую к Delivery Service.
- У каждого сервиса остаётся собственная база данных.
- Outbox Publisher отправляет события повторно при ошибках; неотправленные записи
  остаются в `outbox_events`.
- Kafka single-node без репликации подходит для локальной демонстрации, но не для production.
- Не используй `docker compose down -v`, если хочешь сохранить данные и Kafka log volume.


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

### Подключение к SSE

```powershell
curl.exe -N -H "Authorization: Bearer YOUR_ACCESS_TOKEN" `
  -H "Accept: text/event-stream" `
  http://localhost:8080/api/orders/ORDER_ID/events
```

Сначала придёт событие `order-snapshot` с текущим состоянием заказа. Затем,
после создания доставки, придёт `delivery-status` со статусом `CREATED`.

### Проверка обновления статуса

1. Получи доставку: `GET /api/deliveries/by-order/ORDER_ID`.
2. Скопируй её `id`.
3. Измени статус:

   `PATCH /api/deliveries/DELIVERY_ID/status?status=IN_TRANSIT`

4. В открытом SSE-подключении появится событие `delivery-status` со статусом
   `IN_TRANSIT`. Повтори для `DELIVERED`.

### Логи

```powershell
docker logs -f delivery-service
docker logs -f order-service
```

Ограничения: SSE-буфер хранит последние 1000 событий в памяти одного экземпляра
Order Service и очищается при перезапуске. Текущий снимок заказа при новом
подключении всё равно отправляется. Публикация delivery status выполняется
напрямую после сохранения записи; при недоступности Kafka изменение доставки
сохранится, но SSE-уведомление может быть потеряно. Для production рекомендуется
отдельный transactional outbox и в Delivery Service.
