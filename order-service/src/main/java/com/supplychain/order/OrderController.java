package com.supplychain.order;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
public class OrderController {
    private final OrderService orderService;
    private final OrderEventStreamService eventStream;

    public OrderController(OrderService orderService, OrderEventStreamService eventStream) {
        this.orderService = orderService;
        this.eventStream = eventStream;
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

    // Sends the current order snapshot, then streams delivery status changes from Kafka.
    @GetMapping(value = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @ApiResponse(
            responseCode = "200",
            description = "Order snapshot followed by order status events",
            content = @Content(
                    mediaType = MediaType.TEXT_EVENT_STREAM_VALUE,
                    schema = @Schema(implementation = OrderEvent.class)
            )
    )
    public Flux<ServerSentEvent<OrderEvent>> events(@PathVariable UUID id) {
        return orderService.get(id).flatMapMany(order -> {
            OrderEvent snapshot = new OrderEvent(
                    "order-snapshot", order.id(), order.status(),
                    "Current order state", order.createdAt());
            return Flux.concat(
                    reactor.core.publisher.Mono.just(toSse(snapshot)),
                    eventStream.streamFor(id)
                            .filter(event -> event.occurredAt().isAfter(order.createdAt()))
                            .map(this::toSse)
            );
        });
    }

    private ServerSentEvent<OrderEvent> toSse(OrderEvent event) {
        return ServerSentEvent.<OrderEvent>builder(event)
                .id(event.orderId() + "-" + event.occurredAt().toEpochMilli())
                .event(event.type())
                .build();
    }
}
