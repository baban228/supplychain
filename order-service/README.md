# Order Service

Java 17 + Spring Boot WebFlux. This first milestone uses an in-memory map,
so records disappear on restart. It demonstrates reactive HTTP endpoints;
persistence, Supplier HTTP calls, Kafka and durable SSE history are later milestones.

## Run locally
```bash
mvn spring-boot:run
```
Swagger: http://localhost:8081/swagger-ui.html  
Health: http://localhost:8081/actuator/health
