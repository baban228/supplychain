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
    private final SupplierClient supplierClient;

    public OrderService(OrderRepository repository, SupplierClient supplierClient) {
        this.repository = repository;
        this.supplierClient = supplierClient;
    }

    public Mono<OrderController.OrderDto> create(OrderController.CreateOrderRequest request) {
        return supplierClient.checkAvailability(request.productId(), request.quantity())
                .onErrorMap(SupplierProductNotFoundException.class,
                        ex -> new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage(), ex))
                .onErrorMap(SupplierUnavailableException.class,
                        ex -> new ResponseStatusException(
                                HttpStatus.SERVICE_UNAVAILABLE,
                                "Cannot validate product availability right now",
                                ex))
                .flatMap(availability -> {
                    if (!availability.available()) {
                        return Mono.error(new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                "Insufficient stock. Requested: " + availability.requestedQuantity()
                                        + ", available: " + availability.availableQuantity()
                        ));
                    }

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
                });
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
