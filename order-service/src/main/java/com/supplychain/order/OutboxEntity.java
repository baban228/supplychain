package com.supplychain.order;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import java.time.Instant;
import java.util.UUID;

@Table("outbox_events")
public class OutboxEntity {
    @Id
    private UUID id;
    private String topic;
    private String payload;
    private boolean published;
    private Instant createdAt;
    private Instant publishedAt;

    public OutboxEntity() {}
    public OutboxEntity(UUID id, String topic, String payload, boolean published,
                        Instant createdAt, Instant publishedAt) {
        this.id = id; this.topic = topic; this.payload = payload;
        this.published = published; this.createdAt = createdAt; this.publishedAt = publishedAt;
    }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
}
