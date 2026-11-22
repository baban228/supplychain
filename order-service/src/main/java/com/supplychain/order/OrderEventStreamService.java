package com.supplychain.order;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;
import java.util.UUID;

@Service
public class OrderEventStreamService {
    private final Sinks.Many<OrderEvent> sink = Sinks.many().replay().limit(1000);

    public void publish(OrderEvent event) {
        Sinks.EmitResult result = sink.tryEmitNext(event);
        if (result.isFailure()) {
            org.slf4j.LoggerFactory.getLogger(getClass())
                    .warn("Could not publish order stream event: {}", result);
        }
    }

    public Flux<OrderEvent> streamFor(UUID orderId) {
        return sink.asFlux().filter(event -> orderId.equals(event.orderId()));
    }
}
