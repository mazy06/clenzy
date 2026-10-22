package com.clenzy.integration.oauth;

import io.github.resilience4j.common.circuitbreaker.configuration.CircuitBreakerConfigCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Les refus de verrou Baitly ne sont ni des succès ni des pannes fournisseur. */
@Configuration(proxyBeanMethods = false)
public class BaitlyOAuthCircuitBreakerConfiguration {
    // Configurations parentes : couvre aussi les instances créées à la demande
    // (HomeAway et DocuSign), absentes de la liste des instances application.yml.
    // Les autres exceptions et les seuils restent gérés par la configuration existante.
    @Bean
    CircuitBreakerConfigCustomizer baitlyOAuthDefaultContention() {
        return CircuitBreakerConfigCustomizer.of("default",
                builder -> builder.ignoreExceptions(BaitlyOAuthBusyException.class));
    }

    @Bean
    CircuitBreakerConfigCustomizer baitlyOAuthExternalApiContention() {
        return CircuitBreakerConfigCustomizer.of("external-api",
                builder -> builder.ignoreExceptions(BaitlyOAuthBusyException.class));
    }
}
