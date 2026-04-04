package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Provider Bedrock (Amazon Nova Lite) — fallback gratuit par defaut.
 *
 * Utilise l'API OpenAI-compatible de Bedrock (Project Mantle) :
 * POST /chat/completions avec Authorization: Bearer.
 *
 * Ce provider est utilise automatiquement quand aucune cle OpenAI/Anthropic
 * n'est disponible (ni org BYOK, ni plateforme).
 */
@Component
public class BedrockProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(BedrockProvider.class);

    private final AiProperties aiProperties;
    private final ObjectMapper objectMapper;
    private volatile RestClient restClient;

    public BedrockProvider(AiProperties aiProperties, ObjectMapper objectMapper) {
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;
    }

    @Override
    public String name() {
        return "bedrock";
    }

    @Override
    public AiResponse chat(AiRequest request) {
        return doChat(getOrCreateClient(), request, "bedrock");
    }

    /**
     * Execute une requete avec une cle et base URL dynamiques.
     * Utilise pour le routing via PlatformAiModel (providers OpenAI-compatibles).
     *
     * @param providerLabel nom affiche dans les logs/erreurs (ex: "nvidia", "openai")
     */
    public AiResponse chat(AiRequest request, String apiKey, String baseUrl, String providerLabel) {
        String effectiveBaseUrl = (baseUrl != null && !baseUrl.isBlank())
                ? baseUrl : aiProperties.getBedrock().getBaseUrl();

        RestClient.Builder builder = RestClient.builder()
                .baseUrl(effectiveBaseUrl)
                .defaultHeader("Content-Type", "application/json");
        if (apiKey != null && !apiKey.isBlank()) {
            builder.defaultHeader("Authorization", "Bearer " + apiKey);
        }

        return doChat(builder.build(), request, providerLabel != null ? providerLabel : "bedrock");
    }

    // ─── Core HTTP logic (OpenAI-compatible format) ────────────────────

    @SuppressWarnings("unchecked")
    private AiResponse doChat(RestClient client, AiRequest request, String label) {
        String model = request.model() != null ? request.model() : aiProperties.getBedrock().getModel();

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("temperature", request.temperature());
        requestBody.put("max_tokens", request.maxTokens());
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content", request.systemPrompt()),
                Map.of("role", "user", "content", request.userPrompt())
        ));

        if (request.jsonMode()) {
            requestBody.put("response_format", Map.of("type", "json_object"));
        }

        String responseBody;
        try {
            responseBody = client.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);
        } catch (Exception e) {
            log.error("{} API call failed: {}", label, e.getMessage());
            throw new AiProviderException(label, "API call failed: " + e.getMessage(), e);
        }

        try {
            Map<String, Object> response = objectMapper.readValue(responseBody, Map.class);

            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            if (choices == null || choices.isEmpty()) {
                throw new AiProviderException(label, "Empty choices in response");
            }
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) message.get("content");
            String finishReason = (String) choices.get(0).get("finish_reason");

            Map<String, Object> usage = (Map<String, Object>) response.get("usage");
            int promptTokens = usage != null ? ((Number) usage.get("prompt_tokens")).intValue() : 0;
            int completionTokens = usage != null ? ((Number) usage.get("completion_tokens")).intValue() : 0;
            int totalTokens = usage != null ? ((Number) usage.get("total_tokens")).intValue() : 0;
            String usedModel = (String) response.get("model");

            return new AiResponse(content, promptTokens, completionTokens, totalTokens,
                    usedModel != null ? usedModel : model, finishReason);
        } catch (AiProviderException e) {
            throw e;
        } catch (JsonProcessingException e) {
            log.error("Failed to parse {} response: {}", label, e.getMessage());
            throw new AiProviderException(label, "Failed to parse response", e);
        }
    }

    private RestClient getOrCreateClient() {
        if (restClient == null) {
            AiProperties.Bedrock config = aiProperties.getBedrock();
            RestClient.Builder builder = RestClient.builder()
                    .baseUrl(config.getBaseUrl())
                    .defaultHeader("Content-Type", "application/json");

            if (config.getApiKey() != null && !config.getApiKey().isBlank()) {
                builder.defaultHeader("Authorization", "Bearer " + config.getApiKey());
            }

            restClient = builder.build();
        }
        return restClient;
    }

    // Visible for testing
    void setRestClient(RestClient restClient) {
        this.restClient = restClient;
    }
}
