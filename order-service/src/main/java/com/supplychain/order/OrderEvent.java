package com.supplychain.order;
import java.time.Instant;
import java.util.UUID;
public record OrderEvent(String type, UUID orderId, String status, String message, Instant occurredAt) {}
