package com.supplychain.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
public class OrderController {
    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

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
        return orderService.create(request);
    }

    @GetMapping
    public Flux<OrderDto> list() {
        return orderService.list();
    }

    @GetMapping("/{id}")
    public Mono<OrderDto> get(@PathVariable UUID id) {
        return orderService.get(id);
    }

    @PatchMapping("/{id}/status")
    public Mono<OrderDto> updateStatus(
            @PathVariable UUID id,
            @RequestParam String status
    ) {
        return orderService.updateStatus(id, status);
    }

    // Учебный SSE endpoint: пока отдаёт текущее состояние как поток.
    // Позже подключим сюда Kafka-события и историю статусов из БД.
    @GetMapping(value = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<OrderDto> events(@PathVariable UUID id) {
        return orderService.get(id).flux();
    }
}
