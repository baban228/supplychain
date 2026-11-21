package com.supplychain.order;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@Service
public class OrderService {
    private final OrderRepository repository;

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }

    public Mono<OrderController.OrderDto> create(OrderController.CreateOrderRequest request) {
        OrderEntity order = new OrderEntity(
                UUID.randomUUID(),
                request.customerId(),
                request.productId(),
                request.quantity(),
                request.deliveryAddress(),
                "CREATED",
                Instant.now()
        );
        return repository.save(order).map(this::toDto);
    }

    public Flux<OrderController.OrderDto> list() {
        return repository.findAll().map(this::toDto);
    }

    public Mono<OrderController.OrderDto> get(UUID id) {
        return repository.findById(id)
                .switchIfEmpty(Mono.error(
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found")
                ))
                .map(this::toDto);
    }

    public Mono<OrderController.OrderDto> updateStatus(UUID id, String status) {
        return repository.findById(id)
                .switchIfEmpty(Mono.error(
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found")
                ))
                .flatMap(order -> {
                    order.setStatus(status.toUpperCase());
                    return repository.save(order);
                })
                .map(this::toDto);
    }

    private OrderController.OrderDto toDto(OrderEntity order) {
        return new OrderController.OrderDto(
                order.getId(),
                order.getCustomerId(),
                order.getProductId(),
                order.getQuantity(),
                order.getDeliveryAddress(),
                order.getStatus(),
                order.getCreatedAt()
        );
    }
}
