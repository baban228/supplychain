package com.supplychain.order;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import java.util.UUID;

public interface OutboxRepository extends ReactiveCrudRepository<OutboxEntity, UUID> {
    Flux<OutboxEntity> findTop100ByPublishedFalseOrderByCreatedAtAsc();
}
