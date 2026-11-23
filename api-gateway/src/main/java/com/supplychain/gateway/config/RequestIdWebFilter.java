package com.supplychain.gateway.config;

import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;

import reactor.core.publisher.Mono;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdWebFilter implements WebFilter {

    public static final String HEADER_NAME = "X-Request-ID";
    private static final Pattern VALID_REQUEST_ID = Pattern.compile("[A-Za-z0-9._:-]{1,128}");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String requestId = exchange.getRequest().getHeaders().getFirst(HEADER_NAME);
        if (requestId == null || !VALID_REQUEST_ID.matcher(requestId).matches()) {
            requestId = UUID.randomUUID().toString();
        }

        String resolvedRequestId = requestId;
        ServerWebExchange requestWithId = exchange.mutate()
                .request(request -> request.headers(headers -> headers.set(HEADER_NAME, resolvedRequestId)))
                .build();
        requestWithId.getResponse().beforeCommit(() -> {
            requestWithId.getResponse().getHeaders().set(HEADER_NAME, resolvedRequestId);
            return Mono.empty();
        });
        return chain.filter(requestWithId);
    }
}
