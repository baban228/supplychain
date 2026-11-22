package com.supplychain.order;

import java.time.Instant;
import java.util.UUID;

public record OrderCreatedEvent(
        UUID eventId,
        String eventType,
        UUID orderId,
        String customerId,
        UUID productId,
        int quantity,
        String deliveryAddress,
        Instant createdAt
) {
    public static OrderCreatedEvent from(OrderEntity order) {
        return new OrderCreatedEvent(
                UUID.randomUUID(), "OrderCreated", order.getId(),
                order.getCustomerId(), order.getProductId(), order.getQuantity(),
                order.getDeliveryAddress(), order.getCreatedAt()
        );
    }
}
