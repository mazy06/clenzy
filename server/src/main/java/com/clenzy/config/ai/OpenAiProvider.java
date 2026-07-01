package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementation OpenAI de {@link AiProvider}.
 *
 * Utilise l'API Chat Completions (POST /chat/completions).
 * Parse la reponse au format : choices[0].message.content
 * Tokens : usage.prompt_tokens, usage.completion_tokens, usage.total_tokens
 *
 * Supporte le BYOK via {@link #chat(AiRequest, String)} qui construit un
 * RestClient one-shot avec la cle fournie par l'organisation.
 */
@Component
public class OpenAiProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAiProvider.class);

    private final AiProperties aiProperties;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;
    private RestClient restClient;

    public OpenAiProvider(AiProperties aiProperties, ObjectMapper objectMapper,
                          ApplicationEventPublisher eventPublisher) {
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public String name() {
        return "openai";
    }

    @Override
    public AiResponse chat(AiRequest request) {
        return doChat(getOrCreateClient(), request);
    }

    @Override
    public AiResponse chat(AiRequest request, String apiKey) {
        RestClient client = RestClient.builder()
                .baseUrl(aiProperties.getOpenai().getBaseUrl())
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", "application/json")
                .build();
        return doChat(client, request);
    }

    // ─── Core HTTP logic ────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private AiResponse doChat(RestClient client, AiRequest request) {
        // Source de vérité unique : modèle issu de la config (résolu par AiTargetResolver), jamais de défaut env.
        if (request.model() == null || request.model().isBlank()) {
            throw new AiProviderException("openai",
                    "Aucun modèle résolu : assignez un modèle à la feature dans Paramètres > IA.");
        }
        String model = request.model();

        // L'API OpenAI (api.openai.com) exige `max_completion_tokens` sur les modèles récents
        // (série gpt-5 / o*) — et l'accepte sur tous les modèles courants. Les endpoints
        // OpenAI-COMPATIBLES (NVIDIA, etc.) gardent `max_tokens`. De plus, les modèles
        // « reasoning » n'acceptent QUE la température par défaut → on l'omet pour eux.
        boolean openAiApi = isOpenAiEndpoint(aiProperties.getOpenai().getBaseUrl());
        boolean reasoning = openAiApi && isReasoningModel(model);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        if (!reasoning) {
            requestBody.put("temperature", request.temperature());
        }
        requestBody.put(openAiApi ? "max_completion_tokens" : "max_tokens", request.maxTokens());
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
        } catch (HttpClientErrorException.Gone e) {
            // Modele OpenAI EOL (ex: gpt-4-vision-preview retired 2025).
            throw AiProviderErrorHandler.handleGone(eventPublisher, "openai", model, e);
        } catch (Exception e) {
            throw AiProviderErrorHandler.handleGeneric("openai", e);
        }

        try {
            Map<String, Object> response = objectMapper.readValue(responseBody, Map.class);

            // Extract content from choices[0].message.content
            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            if (choices == null || choices.isEmpty()) {
                throw new AiProviderException("openai", "Empty choices in response");
            }
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) message.get("content");
            String finishReason = (String) choices.get(0).get("finish_reason");

            // Extract token usage
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
            log.error("Failed to parse OpenAI response: {}", e.getMessage());
            throw new AiProviderException("openai", "Failed to parse response", e);
        }
    }

    /** Vrai si l'endpoint est l'API OpenAI officielle (vs un endpoint OpenAI-compatible type NVIDIA). */
    static boolean isOpenAiEndpoint(String baseUrl) {
        return baseUrl != null && baseUrl.toLowerCase().contains("openai.com");
    }

    /** Modèles « reasoning » OpenAI (série o* et gpt-5) : n'acceptent que la température par défaut. */
    static boolean isReasoningModel(String model) {
        if (model == null) {
            return false;
        }
        String m = model.toLowerCase();
        return m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4") || m.startsWith("gpt-5");
    }

    /**
     * Lazy-init du RestClient (evite de creer le client si AI est desactive).
     */
    private RestClient getOrCreateClient() {
        if (restClient == null) {
            AiProperties.OpenAi config = aiProperties.getOpenai();
            restClient = RestClient.builder()
                    .baseUrl(config.getBaseUrl())
                    .defaultHeader("Authorization", "Bearer " + config.getApiKey())
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
