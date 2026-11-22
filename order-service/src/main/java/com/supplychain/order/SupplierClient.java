package com.supplychain.order;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.reactor.circuitbreaker.operator.CircuitBreakerOperator;
import io.github.resilience4j.reactor.retry.RetryOperator;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.retry.Retry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.TimeoutException;

@Component
public class SupplierClient {

    private final WebClient webClient;
    private final CircuitBreaker circuitBreaker;
    private final Retry retry;
    private final Duration timeout;

    public SupplierClient(
            WebClient.Builder loadBalancedWebClientBuilder,
            CircuitBreaker supplierCircuitBreaker,
            Retry supplierRetry,
            @Value("${app.supplier.client.timeout:2s}") Duration timeout
    ) {
        this.webClient = loadBalancedWebClientBuilder
                .baseUrl("http://supplier-service")
                .build();
        this.circuitBreaker = supplierCircuitBreaker;
        this.retry = supplierRetry;
        this.timeout = timeout;
    }

    public Mono<AvailabilityResponse> checkAvailability(UUID productId, int quantity) {
        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/products/{productId}/availability")
                        .queryParam("quantity", quantity)
                        .build(productId))
                .retrieve()
                .onStatus(status -> status.value() == 404,
                        response -> Mono.error(new SupplierProductNotFoundException(
                                "Product " + productId + " was not found in Supplier Service")))
                .bodyToMono(AvailabilityResponse.class)
                .timeout(timeout)
                // Retry only transient transport errors, timeouts and Supplier 5xx responses.
                .transformDeferred(RetryOperator.of(retry))
                // Circuit Breaker observes the final result after retry attempts.
                .transformDeferred(CircuitBreakerOperator.of(circuitBreaker))
                .onErrorMap(CallNotPermittedException.class,
                        ex -> new SupplierUnavailableException(
                                "Supplier Service circuit breaker is OPEN", ex))
                .onErrorMap(TimeoutException.class,
                        ex -> new SupplierUnavailableException(
                                "Supplier Service timed out", ex))
                .onErrorMap(WebClientRequestException.class,
                        ex -> new SupplierUnavailableException(
                                "Cannot connect to Supplier Service", ex))
                .onErrorMap(WebClientResponseException.class,
                        ex -> ex.getStatusCode().is5xxServerError()
                                ? new SupplierUnavailableException(
                                        "Supplier Service returned an error", ex)
                                : ex);
    }

    public record AvailabilityResponse(
            @JsonProperty("product_id") UUID productId,
            boolean available,
            @JsonProperty("requested_quantity") int requestedQuantity,
            @JsonProperty("available_quantity") int availableQuantity,
            @JsonProperty("unit_price") BigDecimal unitPrice
    ) {}
}
