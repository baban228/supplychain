package com.supplychain.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/orders")
public class OrderController {
    private final ConcurrentHashMap<UUID, OrderDto> orders = new ConcurrentHashMap<>();

    public record CreateOrderRequest(
            @NotBlank String customerId,
            @NotNull UUID productId,
            @Min(1) int quantity,
            @NotBlank String deliveryAddress
    ) {}

    public record OrderDto(
            UUID id,
            String customerId,
            UUID productId,
            int quantity,
            String deliveryAddress,
            String status,
            Instant createdAt
    ) {}

    @GetMapping("/health-check")
    public Mono<String> healthCheck() {
        return Mono.just("Order Service is running");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<OrderDto> create(@Valid @RequestBody CreateOrderRequest request) {
        UUID id = UUID.randomUUID();
        OrderDto order = new OrderDto(
                id, request.customerId(), request.productId(),
                request.quantity(), request.deliveryAddress(),
                "CREATED", Instant.now()
        );
        orders.put(id, order);
        return Mono.just(order);
    }

    @GetMapping
    public Flux<OrderDto> list() {
        return Flux.fromIterable(orders.values());
    }

    @GetMapping("/{id}")
    public Mono<OrderDto> get(@PathVariable UUID id) {
        OrderDto order = orders.get(id);
        if (order == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        }
        return Mono.just(order);
    }

    @PatchMapping("/{id}/status")
    public Mono<OrderDto> updateStatus(
            @PathVariable UUID id,
            @RequestParam String status
    ) {
        OrderDto old = orders.get(id);
        if (old == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        }
        OrderDto updated = new OrderDto(
                old.id(), old.customerId(), old.productId(), old.quantity(),
                old.deliveryAddress(), status.toUpperCase(), old.createdAt()
        );
        orders.put(id, updated);
        return Mono.just(updated);
    }

    // Учебный SSE endpoint: пока отдаёт текущее состояние как поток.
    // Позже подключим сюда Kafka-события и историю статусов из БД.
    @GetMapping(value = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<OrderDto> events(@PathVariable UUID id) {
        return get(id).flux();
    }
}
