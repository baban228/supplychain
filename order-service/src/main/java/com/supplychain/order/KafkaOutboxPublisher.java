package com.supplychain.order;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class KafkaOutboxPublisher {
    private static final Logger log = LoggerFactory.getLogger(KafkaOutboxPublisher.class);
    private final OutboxRepository outbox;
    private final KafkaTemplate<String, String> kafka;
    private final AtomicBoolean running = new AtomicBoolean(false);

    public KafkaOutboxPublisher(OutboxRepository outbox, KafkaTemplate<String, String> kafka) {
        this.outbox = outbox;
        this.kafka = kafka;
    }

    @Scheduled(fixedDelayString = "${app.kafka.outbox-poll-ms:1000}")
    public void publishPending() {
        if (!running.compareAndSet(false, true)) return;
        outbox.findTop100ByPublishedFalseOrderByCreatedAtAsc()
                .concatMap(event -> Mono.fromFuture(
                                kafka.send(event.getTopic(), event.getId().toString(), event.getPayload()))
                        .then(Mono.defer(() -> {
                            event.setPublished(true);
                            event.setPublishedAt(Instant.now());
                            return outbox.save(event);
                        }))
                        .doOnSuccess(saved -> log.info("Published outbox event {} to {}",
                                event.getId(), event.getTopic()))
                        .onErrorResume(error -> {
                            log.error("Could not publish outbox event {}", event.getId(), error);
                            return Mono.empty();
                        }))
                .doFinally(signal -> running.set(false))
                .subscribe();
    }
}
