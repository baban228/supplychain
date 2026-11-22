# Delivery Service (NestJS + PostgreSQL + Kafka)

Port: `3000`  
Swagger UI: http://localhost:3000/docs  
Health: http://localhost:3000/api/deliveries/health

Delivery Service consumes `OrderCreated` events from Kafka topic `orders.created`.
For every new order it creates one delivery record in its own PostgreSQL database.
The database has a unique index on `order_id`, so replayed or duplicate Kafka
messages do not create duplicate deliveries.

## Manual API

- `GET /api/deliveries`
- `GET /api/deliveries/by-order/{orderId}`
- `GET /api/deliveries/{id}`
- `PATCH /api/deliveries/{id}/status?status=IN_TRANSIT`

`POST /api/deliveries` remains available for manual/testing purposes.
