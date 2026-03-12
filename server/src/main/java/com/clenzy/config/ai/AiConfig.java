package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Configuration du module AI — active uniquement quand {@code clenzy.ai.enabled=true}.
 *
 * Cree les RestClient partages pour OpenAI et Anthropic, reutilisables
 * par n'importe quel service ayant besoin d'un acces direct aux APIs LLM.
 *
 * Les {@link AiProvider} implementations (OpenAiProvider, AnthropicProvider)
 * utilisent leur propre lazy-init interne, mais ces beans sont disponibles
 * pour les services qui preferent une injection directe.
 */
@Configuration
@ConditionalOnProperty(name = "clenzy.ai.enabled", havingValue = "true")
public class AiConfig {

    @Bean
    @Qualifier("openAiRestClient")
    public RestClient openAiRestClient(AiProperties aiProperties) {
        AiProperties.OpenAi config = aiProperties.getOpenai();
        return RestClient.builder()
                .baseUrl(config.getBaseUrl())
                .defaultHeader("Authorization", "Bearer " + config.getApiKey())
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    @Bean
    @Qualifier("anthropicRestClient")
    public RestClient anthropicRestClient(AiProperties aiProperties) {
        AiProperties.Anthropic config = aiProperties.getAnthropic();
        return RestClient.builder()
                .baseUrl(config.getBaseUrl())
                .defaultHeader("x-api-key", config.getApiKey())
                .defaultHeader("anthropic-version", "2023-06-01")
                .defaultHeader("Content-Type", "application/json")
                .build();
    }
}
