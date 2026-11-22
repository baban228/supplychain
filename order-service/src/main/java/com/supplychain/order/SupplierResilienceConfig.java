package com.supplychain.order;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.concurrent.TimeoutException;

@Configuration
public class SupplierResilienceConfig {

    @Bean
    public CircuitBreaker supplierCircuitBreaker() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
                .slidingWindowSize(10)
                .minimumNumberOfCalls(5)
                .failureRateThreshold(50)
                .waitDurationInOpenState(Duration.ofSeconds(10))
                .permittedNumberOfCallsInHalfOpenState(3)
                .recordException(exception -> {
                    if (exception instanceof WebClientResponseException response) {
                        return response.getStatusCode().is5xxServerError();
                    }
                    return !(exception instanceof SupplierProductNotFoundException);
                })
                .build();

        return CircuitBreaker.of("supplierService", config);
    }

    @Bean
    public Retry supplierRetry(
            @Value("${app.supplier.retry.max-attempts:3}") int maxAttempts,
            @Value("${app.supplier.retry.wait-duration:300ms}") Duration waitDuration
    ) {
        RetryConfig config = RetryConfig.custom()
                .maxAttempts(maxAttempts)
                .waitDuration(waitDuration)
                .retryOnException(exception -> {
                    if (exception instanceof SupplierProductNotFoundException) {
                        return false;
                    }
                    if (exception instanceof WebClientResponseException response) {
                        return response.getStatusCode().is5xxServerError();
                    }
                    return exception instanceof WebClientRequestException
                            || exception instanceof TimeoutException;
                })
                .build();

        return Retry.of("supplierService", config);
    }
}
