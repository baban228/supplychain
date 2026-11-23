package com.supplychain.order;

import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Mono;

@Configuration
public class SupplierClientConfig {

    @Bean
    @LoadBalanced
    public WebClient.Builder loadBalancedWebClientBuilder() {
        return WebClient.builder()
                .filter((request, next) -> Mono.deferContextual(context -> {
                    if (!context.hasKey(RequestIdWebFilter.CONTEXT_KEY)) {
                        return next.exchange(request);
                    }

                    String requestId = context.get(RequestIdWebFilter.CONTEXT_KEY);
                    ClientRequest requestWithId = ClientRequest.from(request)
                            .headers(headers -> headers.set(RequestIdWebFilter.HEADER_NAME, requestId))
                            .build();
                    return next.exchange(requestWithId);
                }));
    }
}
