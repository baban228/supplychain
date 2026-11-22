package com.supplychain.order;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.reactive.TransactionalOperator;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@Service
public class OrderService {
    private static final String ORDER_CREATED_TOPIC = "orders.created";
    private final OrderRepository repository;
    private final SupplierClient supplierClient;
    private final OutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final TransactionalOperator transactionalOperator;
    private final OrderEventStreamService eventStream;

    public OrderService(OrderRepository repository, SupplierClient supplierClient,
                        OutboxRepository outboxRepository, ObjectMapper objectMapper,
                        TransactionalOperator transactionalOperator,
                        OrderEventStreamService eventStream) {
        this.repository = repository;
        this.supplierClient = supplierClient;
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
        this.transactionalOperator = transactionalOperator;
        this.eventStream = eventStream;
    }

    public Mono<OrderController.OrderDto> create(OrderController.CreateOrderRequest request) {
        return supplierClient.checkAvailability(request.productId(), request.quantity())
                .onErrorMap(SupplierProductNotFoundException.class,
                        ex -> new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage(), ex))
                .onErrorMap(SupplierUnavailableException.class,
                        ex -> new ResponseStatusException(
                                HttpStatus.SERVICE_UNAVAILABLE,
                                "Cannot validate product availability right now", ex))
                .flatMap(availability -> {
                    if (!availability.available()) {
                        return Mono.error(new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                "Insufficient stock. Requested: " + availability.requestedQuantity()
                                        + ", available: " + availability.availableQuantity()));
                    }
                    OrderEntity order = new OrderEntity(
                            UUID.randomUUID(), request.customerId(), request.productId(),
                            request.quantity(), request.deliveryAddress(), "CREATED", Instant.now());

                    return repository.save(order)
                            .flatMap(saved -> createOutboxEvent(saved).thenReturn(saved))
                            .as(transactionalOperator::transactional)
                            .map(this::toDto)
                            .doOnNext(dto -> eventStream.publish(new OrderEvent(
                                    "order-created", dto.id(), dto.status(),
                                    "Order successfully created", dto.createdAt())));
                });
    }

    private Mono<OutboxEntity> createOutboxEvent(OrderEntity order) {
        try {
            String payload = objectMapper.writeValueAsString(OrderCreatedEvent.from(order));
            return outboxRepository.save(new OutboxEntity(
                    null, ORDER_CREATED_TOPIC, payload, false, Instant.now(), null));
        } catch (JsonProcessingException e) {
            return Mono.error(e);
        }
    }

    public Flux<OrderController.OrderDto> list() {
        return repository.findAll().map(this::toDto);
    }

    public Mono<OrderController.OrderDto> get(UUID id) {
        return repository.findById(id)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found")))
                .map(this::toDto);
    }

    public Mono<OrderController.OrderDto> updateStatus(UUID id, String status) {
        return repository.findById(id)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found")))
                .flatMap(order -> {
                    order.setStatus(status.toUpperCase());
                    return repository.save(order);
                }).map(this::toDto);
    }

    private OrderController.OrderDto toDto(OrderEntity order) {
        return new OrderController.OrderDto(order.getId(), order.getCustomerId(), order.getProductId(),
                order.getQuantity(), order.getDeliveryAddress(), order.getStatus(), order.getCreatedAt());
    }
}
