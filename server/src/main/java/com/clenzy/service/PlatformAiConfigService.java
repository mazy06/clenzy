package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiTokenBudget;
import com.clenzy.repository.AiTokenBudgetRepository;
import com.clenzy.dto.PlatformAiModelDto;
import com.clenzy.dto.SavePlatformModelRequest;
import com.clenzy.dto.TestPlatformModelRequest;
import com.clenzy.model.PlatformAiFeatureModel;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import com.clenzy.repository.PlatformAiModelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service de gestion des modeles IA plateforme (multi-model architecture).
 *
 * Permet au SUPER_ADMIN de :
 * - Configurer plusieurs modeles IA (un par provider/model)
 * - Assigner un modele specifique a chaque feature (DESIGN, PRICING, etc.)
 * - Tester la connexion avant sauvegarde
 */
@Service
public class PlatformAiConfigService {

    private static final Logger log = LoggerFactory.getLogger(PlatformAiConfigService.class);

    /** Providers supportes avec leurs valeurs par defaut. */
    public static final Map<String, ProviderDefaults> SUPPORTED_PROVIDERS = Map.of(
            "bedrock", new ProviderDefaults("amazon.nova-lite-v1:0", "https://bedrock-mantle.eu-west-1.api.aws/v1"),
            "nvidia", new ProviderDefaults("meta/llama-3.1-8b-instruct", "https://integrate.api.nvidia.com/v1"),
            "openai", new ProviderDefaults("gpt-4o", "https://api.openai.com/v1"),
            "anthropic", new ProviderDefaults("claude-sonnet-4-20250514", "https://api.anthropic.com/v1")
    );

    private final PlatformAiModelRepository modelRepository;
    private final PlatformAiFeatureModelRepository featureModelRepository;
    private final AiTokenBudgetRepository budgetRepository;
    private final AiProperties aiProperties;
    private final AnthropicProvider anthropicProvider;

    public PlatformAiConfigService(PlatformAiModelRepository modelRepository,
                                    PlatformAiFeatureModelRepository featureModelRepository,
                                    AiTokenBudgetRepository budgetRepository,
                                    AiProperties aiProperties,
                                    AnthropicProvider anthropicProvider) {
        this.modelRepository = modelRepository;
        this.featureModelRepository = featureModelRepository;
        this.budgetRepository = budgetRepository;
        this.aiProperties = aiProperties;
        this.anthropicProvider = anthropicProvider;
    }

    /**
     * Liste tous les modeles avec leurs features assignees.
     */
    @Transactional(readOnly = true)
    public List<PlatformAiModelDto> getModels() {
        List<PlatformAiModel> models = modelRepository.findAll();
        List<PlatformAiFeatureModel> allFeatures = featureModelRepository.findAll();

        // Build model ID → list of feature names
        Map<Long, List<String>> featuresByModel = allFeatures.stream()
                .collect(Collectors.groupingBy(
                        fm -> fm.getModel().getId(),
                        Collectors.mapping(PlatformAiFeatureModel::getFeature, Collectors.toList())
                ));

        return models.stream()
                .map(m -> new PlatformAiModelDto(
                        m.getId(),
                        m.getName(),
                        m.getProvider(),
                        m.getModelId(),
                        m.getMaskedApiKey(),
                        m.getBaseUrl(),
                        featuresByModel.getOrDefault(m.getId(), List.of()),
                        m.getLastValidatedAt(),
                        m.getUpdatedAt()
                ))
                .toList();
    }

    /**
     * Retourne le modele actif pour une feature donnee (ou vide si non assigne).
     */
    @Transactional(readOnly = true)
    public Optional<PlatformAiModel> getActiveModelForFeature(String feature) {
        return featureModelRepository.findByFeature(feature)
                .map(PlatformAiFeatureModel::getModel);
    }

    /**
     * Teste la connexion a un modele avec les credentials donnes.
     */
    public boolean testModel(TestPlatformModelRequest request) {
        String provider = request.provider();
        validateProvider(provider);
        validateBaseUrl(request.baseUrl());

        String baseUrl = resolveBaseUrl(provider, request.baseUrl());

        try {
            if ("anthropic".equals(provider)) {
                return testAnthropicProvider(request.apiKey());
            }
            return testOpenAiCompatibleProvider(baseUrl, request.apiKey(), request.modelId());
        } catch (Exception e) {
            log.debug("Platform model test failed for {} / {}", provider, request.modelId());
            return false;
        }
    }

    /**
     * Sauvegarde (cree ou met a jour) un modele IA plateforme.
     */
    @Transactional
    public PlatformAiModelDto saveModel(SavePlatformModelRequest request, String updatedBy) {
        String provider = request.provider();
        validateProvider(provider);
        validateBaseUrl(request.baseUrl());

        String baseUrl = resolveBaseUrl(provider, request.baseUrl());

        PlatformAiModel model;
        if (request.id() != null) {
            model = modelRepository.findById(request.id())
                    .orElseThrow(() -> new IllegalArgumentException("Model not found: " + request.id()));
        } else {
            model = new PlatformAiModel();
        }

        model.setName(request.name());
        model.setProvider(provider);
        model.setModelId(request.modelId());
        model.setApiKey(request.apiKey());
        model.setBaseUrl(baseUrl);
        model.setLastValidatedAt(LocalDateTime.now());
        model.setUpdatedBy(updatedBy);

        final PlatformAiModel savedModel = modelRepository.save(model);

        log.info("Platform AI model saved: {} ({}/{}) by {}", savedModel.getName(), provider, request.modelId(), updatedBy);

        List<String> assignedFeatures = featureModelRepository.findAll().stream()
                .filter(fm -> fm.getModel().getId().equals(savedModel.getId()))
                .map(PlatformAiFeatureModel::getFeature)
                .toList();

        return new PlatformAiModelDto(
                savedModel.getId(),
                savedModel.getName(),
                savedModel.getProvider(),
                savedModel.getModelId(),
                savedModel.getMaskedApiKey(),
                savedModel.getBaseUrl(),
                assignedFeatures,
                savedModel.getLastValidatedAt(),
                savedModel.getUpdatedAt()
        );
    }

    /**
     * Supprime un modele (cascade vers les feature assignments).
     */
    @Transactional
    public void deleteModel(Long modelId) {
        if (!modelRepository.existsById(modelId)) {
            throw new IllegalArgumentException("Model not found: " + modelId);
        }
        modelRepository.deleteById(modelId);
        log.info("Platform AI model deleted: id={}", modelId);
    }

    /**
     * Assigne un modele a une feature (upsert).
     */
    @Transactional
    public void assignModelToFeature(Long modelId, String feature) {
        PlatformAiModel model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));

        PlatformAiFeatureModel featureModel = featureModelRepository.findByFeature(feature)
                .orElseGet(() -> new PlatformAiFeatureModel(feature, model));

        featureModel.setModel(model);
        featureModelRepository.save(featureModel);

        log.info("Feature {} assigned to model {} ({})", feature, model.getName(), model.getId());
    }

    /**
     * Desassigne une feature (supprime le mapping).
     */
    @Transactional
    public void unassignFeature(String feature) {
        featureModelRepository.deleteByFeature(feature);
        log.info("Feature {} unassigned", feature);
    }

    /**
     * Retourne toutes les associations feature → modele.
     */
    @Transactional(readOnly = true)
    public Map<String, PlatformAiModelDto> getFeatureAssignments() {
        List<PlatformAiFeatureModel> all = featureModelRepository.findAll();

        // Collect all assigned features per model for the DTO
        Map<Long, List<String>> featuresByModel = all.stream()
                .collect(Collectors.groupingBy(
                        fm -> fm.getModel().getId(),
                        Collectors.mapping(PlatformAiFeatureModel::getFeature, Collectors.toList())
                ));

        Map<String, PlatformAiModelDto> result = new LinkedHashMap<>();
        for (PlatformAiFeatureModel fm : all) {
            PlatformAiModel m = fm.getModel();
            result.put(fm.getFeature(), new PlatformAiModelDto(
                    m.getId(),
                    m.getName(),
                    m.getProvider(),
                    m.getModelId(),
                    m.getMaskedApiKey(),
                    m.getBaseUrl(),
                    featuresByModel.getOrDefault(m.getId(), List.of()),
                    m.getLastValidatedAt(),
                    m.getUpdatedAt()
            ));
        }
        return result;
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private void validateProvider(String provider) {
        if (!SUPPORTED_PROVIDERS.containsKey(provider)) {
            throw new IllegalArgumentException("Unsupported provider: " + provider
                    + ". Supported: " + SUPPORTED_PROVIDERS.keySet());
        }
    }

    private void validateBaseUrl(String baseUrl) {
        if (baseUrl != null && !baseUrl.isBlank() && !baseUrl.startsWith("https://")) {
            throw new IllegalArgumentException("Base URL must use HTTPS: " + baseUrl);
        }
    }

    private String resolveBaseUrl(String provider, String customBaseUrl) {
        if (customBaseUrl != null && !customBaseUrl.isBlank()) return customBaseUrl;
        return SUPPORTED_PROVIDERS.get(provider).baseUrl();
    }

    private boolean testOpenAiCompatibleProvider(String baseUrl, String apiKey, String model) {
        RestClient client = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", "application/json")
                .requestFactory(new org.springframework.http.client.SimpleClientHttpRequestFactory() {{
                    setConnectTimeout(10_000);
                    setReadTimeout(30_000);
                }})
                .build();

        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(Map.of("role", "user", "content", "Say OK")),
                "max_tokens", 5,
                "temperature", 0.0
        );

        String response = client.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);

        return response != null && response.contains("choices");
    }

    private boolean testAnthropicProvider(String apiKey) {
        AiRequest request = AiRequest.of("You are a test assistant.", "Say OK");
        try {
            AiResponse response = anthropicProvider.chat(request, apiKey);
            return response.content() != null && !response.content().isBlank();
        } catch (AiProviderException e) {
            return false;
        }
    }

    // ─── Token Budget per feature ────────────────────────────────────────

    /**
     * Retourne le budget mensuel de tokens pour chaque feature.
     * Si pas configure en DB, retourne la valeur par defaut de application.yml.
     */
    @Transactional(readOnly = true)
    public Map<String, Long> getFeatureBudgets() {
        long defaultLimit = aiProperties.getTokenBudget().getDefaultMonthlyTokens();
        Map<String, Long> budgets = new LinkedHashMap<>();
        for (AiFeature feature : AiFeature.values()) {
            long limit = budgetRepository.findByOrganizationIdAndFeature(null, feature)
                    .map(AiTokenBudget::getMonthlyTokenLimit)
                    .orElse(defaultLimit);
            budgets.put(feature.name(), limit);
        }
        return budgets;
    }

    /**
     * Definit le budget mensuel de tokens pour une feature (global plateforme).
     * Utilise orgId=null pour indiquer que c'est un budget plateforme par defaut.
     */
    @Transactional
    public void setFeatureBudget(String featureName, long limit) {
        AiFeature feature = AiFeature.valueOf(featureName);
        AiTokenBudget budget = budgetRepository.findByOrganizationIdAndFeature(null, feature)
                .orElseGet(() -> {
                    AiTokenBudget b = new AiTokenBudget(null, feature, limit);
                    return b;
                });
        budget.setMonthlyTokenLimit(limit);
        budgetRepository.save(budget);
        log.info("Platform AI budget set for feature {}: {} tokens/month", feature, limit);
    }

    public record ProviderDefaults(String model, String baseUrl) {}
}
