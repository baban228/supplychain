package com.supplychain.order;

import java.util.List;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.servers.Server;

@Configuration
public class OpenApiConfig {

    @Bean
    public GroupedOpenApi gatewayOpenApi() {
        return GroupedOpenApi.builder()
                .group("gateway")
                .addOpenApiCustomizer(openApi -> {
                    openApi.setServers(List.of(new Server().url("/api")));
                    if (openApi.getComponents() == null) {
                        openApi.setComponents(new Components());
                    }
                    openApi.getComponents().addSecuritySchemes(
                            "bearerAuth",
                            new SecurityScheme()
                                    .type(SecurityScheme.Type.HTTP)
                                    .scheme("bearer")
                                    .bearerFormat("JWT")
                    );
                    openApi.addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
                })
                .build();
    }
}
