package com.supplychain.order;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.UUID;

@Component
public class DeliveryStatusKafkaListener {
    private static final Logger log = LoggerFactory.getLogger(DeliveryStatusKafkaListener.class);
    private final ObjectMapper objectMapper;
    private final OrderEventStreamService eventStream;

    public DeliveryStatusKafkaListener(ObjectMapper objectMapper, OrderEventStreamService eventStream) {
        this.objectMapper = objectMapper;
        this.eventStream = eventStream;
    }

    @KafkaListener(topics = "deliveries.status.updated", groupId = "order-service-events")
    public void onDeliveryStatusUpdated(String payload) throws Exception {
        DeliveryStatusEvent event = objectMapper.readValue(payload, DeliveryStatusEvent.class);
        if (event.orderId() == null || event.status() == null) {
            log.warn("Ignoring invalid delivery status event");
            return;
        }
        eventStream.publish(new OrderEvent(
                "delivery-status", event.orderId(), event.status(),
                "Delivery status changed to " + event.status(),
                event.occurredAt() == null ? Instant.now() : event.occurredAt()
        ));
        log.info("Received delivery status {} for order {}", event.status(), event.orderId());
    }

    public record DeliveryStatusEvent(
            String eventId, String eventType, UUID orderId,
            String deliveryId, String status, Instant occurredAt
    ) {}
}
