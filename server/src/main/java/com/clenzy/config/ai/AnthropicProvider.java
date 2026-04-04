package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Implementation Anthropic Claude de {@link AiProvider}.
 *
 * Utilise l'API Messages (POST /messages).
 * Parse la reponse au format : content[0].text
 * Tokens : usage.input_tokens, usage.output_tokens
 *
 * Supporte le BYOK via {@link #chat(AiRequest, String)} qui construit un
 * RestClient one-shot avec la cle fournie par l'organisation.
 */
@Component
public class AnthropicProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(AnthropicProvider.class);
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    private final AiProperties aiProperties;
    private final ObjectMapper objectMapper;
    private RestClient restClient;

    public AnthropicProvider(AiProperties aiProperties, ObjectMapper objectMapper) {
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;
    }

    @Override
    public String name() {
        return "anthropic";
    }

    @Override
    public AiResponse chat(AiRequest request) {
        return doChat(getOrCreateClient(), request);
    }

    @Override
    public AiResponse chat(AiRequest request, String apiKey) {
        return chat(request, apiKey, null);
    }

    /**
     * Envoie une requete avec une cle et base URL dynamiques.
     * Utilise pour le routing via PlatformAiModel.
     */
    public AiResponse chat(AiRequest request, String apiKey, String baseUrl) {
        String effectiveBaseUrl = (baseUrl != null && !baseUrl.isBlank())
                ? baseUrl : aiProperties.getAnthropic().getBaseUrl();
        RestClient client = RestClient.builder()
                .baseUrl(effectiveBaseUrl)
                .defaultHeader("x-api-key", apiKey)
                .defaultHeader("anthropic-version", ANTHROPIC_VERSION)
                .defaultHeader("Content-Type", "application/json")
                .build();
        return doChat(client, request);
    }

    // ─── Core HTTP logic ────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private AiResponse doChat(RestClient client, AiRequest request) {
        String model = request.model() != null ? request.model() : aiProperties.getAnthropic().getModel();

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "max_tokens", request.maxTokens(),
                "system", request.systemPrompt(),
                "messages", List.of(
                        Map.of("role", "user", "content", request.userPrompt())
                )
        );

        String responseBody;
        try {
            responseBody = client.post()
                    .uri("/messages")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);
        } catch (Exception e) {
            log.error("Anthropic API call failed: {}", e.getMessage());
            throw new AiProviderException("anthropic", "API call failed: " + e.getMessage(), e);
        }

        try {
            Map<String, Object> response = objectMapper.readValue(responseBody, Map.class);

            // Extract content from content[0].text
            List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
            if (content == null || content.isEmpty()) {
                throw new AiProviderException("anthropic", "Empty content in response");
            }
            String text = (String) content.get(0).get("text");
            String stopReason = (String) response.get("stop_reason");

            // Extract token usage
            Map<String, Object> usage = (Map<String, Object>) response.get("usage");
            int inputTokens = usage != null ? ((Number) usage.get("input_tokens")).intValue() : 0;
            int outputTokens = usage != null ? ((Number) usage.get("output_tokens")).intValue() : 0;
            int totalTokens = inputTokens + outputTokens;
            String usedModel = (String) response.get("model");

            return new AiResponse(text, inputTokens, outputTokens, totalTokens,
                    usedModel != null ? usedModel : model, stopReason);
        } catch (AiProviderException e) {
            throw e;
        } catch (JsonProcessingException e) {
            log.error("Failed to parse Anthropic response: {}", e.getMessage());
            throw new AiProviderException("anthropic", "Failed to parse response", e);
        }
    }

    /**
     * Lazy-init du RestClient (evite de creer le client si AI est desactive).
     */
    private RestClient getOrCreateClient() {
        if (restClient == null) {
            AiProperties.Anthropic config = aiProperties.getAnthropic();
            restClient = RestClient.builder()
                    .baseUrl(config.getBaseUrl())
                    .defaultHeader("x-api-key", config.getApiKey())
                    .defaultHeader("anthropic-version", ANTHROPIC_VERSION)
                    .defaultHeader("Content-Type", "application/json")
                    .build();
        }
        return restClient;
    }

    // Visible for testing
    void setRestClient(RestClient restClient) {
        this.restClient = restClient;
    }
}
