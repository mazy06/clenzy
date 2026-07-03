package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiTokenBudget;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.repository.AiTokenBudgetRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.dto.AiCatalogModelDto;
import com.clenzy.dto.PlatformAiModelDto;
import com.clenzy.dto.SavePlatformModelRequest;
import com.clenzy.dto.TestPlatformModelRequest;
import com.clenzy.model.PlatformAiFeatureModel;
import com.clenzy.model.PlatformAiFeatureProvider;
import com.clenzy.model.AiModelAvailability;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import com.clenzy.repository.PlatformAiFeatureProviderRepository;
import com.clenzy.repository.PlatformAiModelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
            "anthropic", new ProviderDefaults("claude-sonnet-4-20250514", "https://api.anthropic.com/v1"),
            // Voyage AI : provider d'EMBEDDINGS (et rerank) uniquement — pas de chat.
            "voyage", new ProviderDefaults("voyage-3-large", "https://api.voyageai.com")
    );

    /** Providers connectables en BYOK (cle org ou partagee) assignables a une feature. */
    public static final java.util.Set<String> CONNECTABLE_PROVIDERS = java.util.Set.of("openai", "anthropic");

    private final PlatformAiModelRepository modelRepository;
    private final PlatformAiFeatureModelRepository featureModelRepository;
    private final PlatformAiFeatureProviderRepository featureProviderRepository;
    private final AiTokenBudgetRepository budgetRepository;
    private final AiProperties aiProperties;
    private final AnthropicProvider anthropicProvider;
    private final NotificationService notificationService;
    private final Clock clock;
    private final OrgAiApiKeyRepository orgAiApiKeyRepository;
    private final AiModelReplacementSuggester replacementSuggester;

    public PlatformAiConfigService(PlatformAiModelRepository modelRepository,
                                    PlatformAiFeatureModelRepository featureModelRepository,
                                    PlatformAiFeatureProviderRepository featureProviderRepository,
                                    AiTokenBudgetRepository budgetRepository,
                                    AiProperties aiProperties,
                                    AnthropicProvider anthropicProvider,
                                    NotificationService notificationService,
                                    Clock clock,
                                    OrgAiApiKeyRepository orgAiApiKeyRepository,
                                    AiModelReplacementSuggester replacementSuggester) {
        this.modelRepository = modelRepository;
        this.featureModelRepository = featureModelRepository;
        this.featureProviderRepository = featureProviderRepository;
        this.budgetRepository = budgetRepository;
        this.aiProperties = aiProperties;
        this.anthropicProvider = anthropicProvider;
        this.notificationService = notificationService;
        this.clock = clock;
        this.orgAiApiKeyRepository = orgAiApiKeyRepository;
        this.replacementSuggester = replacementSuggester;
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
                .map(m -> toDto(m, featuresByModel.getOrDefault(m.getId(), List.of())))
                .toList();
    }

    /** Mappe une entité + ses features assignées vers le DTO (inclut le statut de disponibilité). */
    private PlatformAiModelDto toDto(PlatformAiModel m, List<String> features) {
        return new PlatformAiModelDto(
                m.getId(), m.getName(), m.getProvider(), m.getModelId(),
                m.getMaskedApiKey(), m.getBaseUrl(), features,
                m.getLastValidatedAt(), m.getUpdatedAt(),
                m.getAvailabilityStatus() != null ? m.getAvailabilityStatus().name() : "UNKNOWN",
                m.getLastAvailabilityCheckAt(), m.getAvailabilityError());
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
     * Premier modele plateforme configure pour un {@code provider} donne, avec une cle
     * utilisable (non vide) ET non marque {@code UNAVAILABLE} par le monitoring. Sert au
     * <b>failover</b> ({@code AiTargetResolver}) : recuperer une cible Anthropic/OpenAI
     * de repli meme si elle n'est PAS assignee a ASSISTANT_CHAT (un modele simplement configure
     * dans le catalogue suffit). Aligne sur {@code AiTargetResolver} (filtre usable) : un modele sonde
     * indisponible (404/410/cle invalide) n'est jamais retourne comme repli.
     */
    @Transactional(readOnly = true)
    public Optional<PlatformAiModel> findUsableModelByProvider(String provider) {
        if (provider == null || provider.isBlank()) {
            return Optional.empty();
        }
        return modelRepository.findAll().stream()
                .filter(m -> provider.equalsIgnoreCase(m.getProvider()))
                .filter(m -> m.getApiKey() != null && !m.getApiKey().isBlank())
                .filter(m -> m.getAvailabilityStatus() != AiModelAvailability.UNAVAILABLE)
                .findFirst();
    }

    /**
     * Teste la connexion a un modele avec les credentials donnes.
     */
    public boolean testModel(TestPlatformModelRequest request) {
        String provider = request.provider();
        validateProvider(provider);
        validateBaseUrl(request.baseUrl());

        String baseUrl = resolveBaseUrl(provider, request.baseUrl());

        // Clé : si fournie on l'utilise ; sinon on réutilise une clé déjà
        // configurée pour ce provider (modèle plateforme existant) — permet de
        // tester un changement de modèle sans recoller la clé.
        String apiKey = request.apiKey();
        if (apiKey == null || apiKey.isBlank()) {
            apiKey = reusableKeyForProvider(provider);
        }
        if (apiKey == null || apiKey.isBlank()) {
            return false; // aucune clé disponible → test impossible
        }

        try {
            if (isEmbeddingModel(provider, request.modelId())) {
                return testEmbeddingProvider(baseUrl, apiKey, request.modelId());
            }
            if ("anthropic".equals(provider)) {
                return testAnthropicProvider(apiKey);
            }
            return testOpenAiCompatibleProvider(baseUrl, apiKey, request.modelId());
        } catch (Exception e) {
            log.debug("Platform model test failed for {} / {}", provider, request.modelId());
            return false;
        }
    }

    /** Première clé non vide d'un modèle plateforme déjà configuré pour ce provider. */
    private String reusableKeyForProvider(String provider) {
        return modelRepository.findAll().stream()
                .filter(m -> provider.equals(m.getProvider())
                        && m.getApiKey() != null && !m.getApiKey().isBlank())
                .map(PlatformAiModel::getApiKey)
                .findFirst()
                .orElse(null);
    }

    /**
     * Sauvegarde (cree ou met a jour) un modele IA plateforme.
     */
    @Transactional
    public PlatformAiModelDto saveModel(SavePlatformModelRequest request, String updatedBy, Long requesterOrgId) {
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
        // Clé : si fournie on l'utilise ; sinon on réutilise une clé existante
        // (modèle plateforme du même provider, ou connexion org du demandeur).
        // En édition, on conserve la clé du modèle. Aucun secret n'est renvoyé
        // au client : la réutilisation se fait ici, côté serveur.
        String apiKey = request.apiKey();
        if (apiKey == null || apiKey.isBlank()) {
            apiKey = (request.id() != null) ? model.getApiKey() : resolveReusableKey(provider, requesterOrgId);
        }
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException(
                    "Clé API requise : aucune clé réutilisable trouvée pour le provider " + provider + ".");
        }
        model.setApiKey(apiKey);
        model.setBaseUrl(baseUrl);
        model.setLastValidatedAt(LocalDateTime.now());
        model.setUpdatedBy(updatedBy);

        final PlatformAiModel savedModel = modelRepository.save(model);

        log.info("Platform AI model saved: {} ({}/{}) by {}", savedModel.getName(), provider, request.modelId(), updatedBy);

        List<String> assignedFeatures = featureModelRepository.findAll().stream()
                .filter(fm -> fm.getModel().getId().equals(savedModel.getId()))
                .map(PlatformAiFeatureModel::getFeature)
                .toList();

        return toDto(savedModel, assignedFeatures);
    }

    /**
     * Supprime un modele (cascade vers les feature assignments).
     */
    @Transactional
    public void deleteModel(Long modelId) {
        if (!modelRepository.existsById(modelId)) {
            throw new IllegalArgumentException("Model not found: " + modelId);
        }
        // Purge d'abord les assignations de features pointant vers ce modèle :
        // ne pas dépendre du ON DELETE CASCADE de la FK (absent si le schéma est
        // géré par Hibernate ddl-auto plutôt que par Liquibase). Sinon, la
        // suppression viole la contrainte et échoue silencieusement côté UI.
        featureModelRepository.deleteByModelId(modelId);
        modelRepository.deleteById(modelId);
        log.info("Platform AI model deleted: id={}", modelId);
    }

    /**
     * Assigne un modele a une feature (upsert).
     * Mutuellement exclusif avec un provider connecte : supprime l'eventuelle
     * assignation de provider pour cette feature.
     */
    @Transactional
    public void assignModelToFeature(Long modelId, String feature) {
        PlatformAiModel model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));

        enforceSameProviderForAssistantTiers(feature, model.getProvider());

        // Exclusivite mutuelle : une feature a soit un modele plateforme, soit un provider connecte.
        featureProviderRepository.deleteByFeature(feature);

        PlatformAiFeatureModel featureModel = featureModelRepository.findByFeature(feature)
                .orElseGet(() -> new PlatformAiFeatureModel(feature, model));

        featureModel.setModel(model);
        featureModelRepository.save(featureModel);

        log.info("Feature {} assigned to model {} ({})", feature, model.getName(), model.getId());
    }

    /**
     * Assigne un provider connecte (BYOK OpenAI/Anthropic) a une feature.
     * Mutuellement exclusif avec un modele plateforme : supprime l'eventuelle
     * assignation de modele pour cette feature.
     */
    @Transactional
    public void assignProviderToFeature(String feature, String provider) {
        validateFeature(feature);
        if (!CONNECTABLE_PROVIDERS.contains(provider)) {
            throw new IllegalArgumentException("Provider non connectable: " + provider
                    + ". Valeurs acceptees: " + CONNECTABLE_PROVIDERS);
        }
        if (ASSISTANT_TIER_FEATURES.contains(feature)) {
            throw new IllegalArgumentException(
                    "Les tiers assistant (" + feature + ") prennent un modele plateforme, pas un provider connecte");
        }
        enforceSameProviderForAssistantTiers(feature, provider);

        // Exclusivite mutuelle : une feature a soit un modele plateforme, soit un provider connecte.
        featureModelRepository.deleteByFeature(feature);

        PlatformAiFeatureProvider mapping = featureProviderRepository.findByFeature(feature)
                .orElseGet(() -> new PlatformAiFeatureProvider(feature, provider));
        mapping.setProvider(provider);
        featureProviderRepository.save(mapping);

        log.info("Feature {} assigned to connected provider {}", feature, provider);
    }

    /**
     * Desassigne une feature (supprime le mapping modele ET provider).
     */
    @Transactional
    public void unassignFeature(String feature) {
        featureModelRepository.deleteByFeature(feature);
        featureProviderRepository.deleteByFeature(feature);
        log.info("Feature {} unassigned", feature);
    }

    /**
     * Retourne le provider connecte assigne pour une feature (ou vide si non assigne).
     */
    @Transactional(readOnly = true)
    public Optional<String> getActiveProviderForFeature(String feature) {
        return featureProviderRepository.findByFeature(feature)
                .map(PlatformAiFeatureProvider::getProvider);
    }

    /**
     * Retourne toutes les associations feature → provider connecte.
     */
    @Transactional(readOnly = true)
    public Map<String, String> getFeatureProviderAssignments() {
        Map<String, String> result = new LinkedHashMap<>();
        for (PlatformAiFeatureProvider fp : featureProviderRepository.findAll()) {
            result.put(fp.getFeature(), fp.getProvider());
        }
        return result;
    }

    /** Features "tier" de l'assistant (T-03) : modele du MEME provider que la reference ASSISTANT_CHAT. */
    private static final Set<String> ASSISTANT_TIER_FEATURES =
            Set.of(AiFeature.ASSISTANT_SMALL.name(), AiFeature.ASSISTANT_STRONG.name());

    /**
     * Regle tiers assistant (2026-07-02) : un modele assigne a ASSISTANT_SMALL/STRONG
     * DOIT etre du meme provider que la reference ASSISTANT_CHAT (modele plateforme ou
     * provider connecte) — sinon le tier serait silencieusement ignore au runtime
     * (garde meme-provider de TierModelResolver). Reciproque : changer le provider
     * d'ASSISTANT_CHAT exige de desassigner d'abord les tiers divergents.
     */
    private void enforceSameProviderForAssistantTiers(String feature, String newProvider) {
        if (ASSISTANT_TIER_FEATURES.contains(feature)) {
            String reference = assistantChatProvider().orElseThrow(() -> new IllegalArgumentException(
                    "Assignez d'abord un modele ou un provider a ASSISTANT_CHAT : "
                            + "les tiers doivent etre du meme provider que l'assistant"));
            if (!reference.equalsIgnoreCase(newProvider)) {
                throw new IllegalArgumentException("Le modele du tier doit etre du provider '" + reference
                        + "' (celui de l'Assistant IA) — recu : '" + newProvider + "'");
            }
            return;
        }
        if (AiFeature.ASSISTANT_CHAT.name().equals(feature)) {
            for (String tier : ASSISTANT_TIER_FEATURES) {
                String tierProvider = featureModelRepository.findByFeature(tier)
                        .map(fm -> fm.getModel().getProvider())
                        .orElse(null);
                if (tierProvider != null && !tierProvider.equalsIgnoreCase(newProvider)) {
                    throw new IllegalArgumentException("Le tier " + tier + " est assigne a un modele '"
                            + tierProvider + "' : desassignez-le avant de passer l'Assistant IA sur '"
                            + newProvider + "' (les tiers doivent etre du meme provider)");
                }
            }
        }
    }

    /** Provider de reference de l'assistant : modele plateforme assigne, sinon provider connecte. */
    private Optional<String> assistantChatProvider() {
        Optional<String> byModel = featureModelRepository.findByFeature(AiFeature.ASSISTANT_CHAT.name())
                .map(fm -> fm.getModel().getProvider());
        if (byModel.isPresent()) {
            return byModel;
        }
        return featureProviderRepository.findByFeature(AiFeature.ASSISTANT_CHAT.name())
                .map(PlatformAiFeatureProvider::getProvider);
    }

    private void validateFeature(String feature) {
        try {
            AiFeature.valueOf(feature);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("Feature IA inconnue: " + feature);
        }
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
            result.put(fm.getFeature(), toDto(m, featuresByModel.getOrDefault(m.getId(), List.of())));
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

    /**
     * Un modele d'embeddings (a tester via {@code /v1/embeddings}, pas {@code /chat/completions}) :
     * provider Voyage (embedding-only) ou {@code modelId} contenant « embedding » (OpenAI). Evite
     * que le probe de disponibilite marque a tort UNAVAILABLE un modele d'embeddings sonde en chat.
     */
    private static boolean isEmbeddingModel(String provider, String modelId) {
        return "voyage".equalsIgnoreCase(provider)
                || (modelId != null && modelId.toLowerCase(java.util.Locale.ROOT).contains("embedding"));
    }

    /** Teste/probe un modele d'embeddings : POST {baseUrl}/v1/embeddings {input:["ping"], model}. */
    private boolean testEmbeddingProvider(String baseUrl, String apiKey, String model) {
        String endpoint = baseUrl.endsWith("/v1") ? "/embeddings" : "/v1/embeddings";
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
                "input", List.of("ping"),
                "model", model
        );

        String response = client.post()
                .uri(endpoint)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);

        return response != null && response.contains("embedding");
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

    // ─── Disponibilité des modèles (probe proactif) ──────────────────────

    /** Re-vérifie TOUS les modèles configurés (appelé par le scheduler quotidien). */
    @Transactional
    public void recheckAllAvailability() {
        List<PlatformAiModel> models = modelRepository.findAll();
        log.info("AI model availability: re-checking {} model(s)", models.size());
        for (PlatformAiModel m : models) {
            applyAvailabilityProbe(m);
        }
    }

    /** Re-vérifie UN modèle à la demande (bouton « Revérifier ») → DTO à jour. */
    @Transactional
    public PlatformAiModelDto recheckAvailability(Long id) {
        PlatformAiModel m = modelRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + id));
        applyAvailabilityProbe(m);
        List<String> features = featureModelRepository.findAll().stream()
                .filter(fm -> fm.getModel().getId().equals(m.getId()))
                .map(PlatformAiFeatureModel::getFeature)
                .toList();
        return toDto(m, features);
    }

    /** Probe + persistance du statut + notification admin sur passage en indisponible. */
    private void applyAvailabilityProbe(PlatformAiModel m) {
        AiModelAvailability previous = m.getAvailabilityStatus();
        ProbeOutcome outcome = probeModel(m);
        m.setAvailabilityStatus(outcome.available()
                ? AiModelAvailability.AVAILABLE : AiModelAvailability.UNAVAILABLE);
        m.setLastAvailabilityCheckAt(LocalDateTime.now(clock));
        m.setAvailabilityError(outcome.available() ? null : outcome.error());
        modelRepository.save(m);
        // Notifie UNE FOIS par épisode d'indisponibilité (transition vers UNAVAILABLE).
        if (!outcome.available() && previous != AiModelAvailability.UNAVAILABLE) {
            notifyModelUnavailable(m);
        }
    }

    private void notifyModelUnavailable(PlatformAiModel m) {
        String suggestion = replacementSuggester.sentence(m.getProvider(), m.getModelId(), m.getId());
        notificationService.notifyAllPlatformStaff(
                NotificationKey.AI_MODEL_EOL,
                "Modèle IA indisponible : " + m.getName(),
                "Le modèle « " + m.getName() + " » (" + m.getProvider() + " / " + m.getModelId()
                        + ") n'est plus joignable chez le provider. Vérifie-le ou remplace-le dans "
                        + "Paramètres > IA." + suggestion + " Détail : "
                        + (m.getAvailabilityError() != null ? m.getAvailabilityError() : "—"),
                "/settings?tab=ai");
        log.warn("AI model '{}' ({}/{}) UNAVAILABLE: {}",
                m.getName(), m.getProvider(), m.getModelId(), m.getAvailabilityError());
    }

    /** Teste la callabilité réelle du modèle (sur son modelId exact) en capturant l'erreur HTTP. */
    public ProbeOutcome probeModel(PlatformAiModel m) {
        String provider = m.getProvider();
        String baseUrl = resolveBaseUrl(provider, m.getBaseUrl());
        try {
            boolean ok;
            if (isEmbeddingModel(provider, m.getModelId())) {
                ok = testEmbeddingProvider(baseUrl, m.getApiKey(), m.getModelId());
            } else if ("anthropic".equals(provider)) {
                ok = probeAnthropicModel(baseUrl, m.getApiKey(), m.getModelId());
            } else {
                ok = testOpenAiCompatibleProvider(baseUrl, m.getApiKey(), m.getModelId());
            }
            return ok ? ProbeOutcome.ok()
                      : ProbeOutcome.failed("Réponse inattendue du provider.");
        } catch (HttpClientErrorException e) {
            return ProbeOutcome.failed(
                    "HTTP " + e.getStatusCode().value() + " — " + truncate(e.getResponseBodyAsString()));
        } catch (Exception e) {
            return ProbeOutcome.failed(e.getClass().getSimpleName()
                    + (e.getMessage() != null ? " : " + e.getMessage() : ""));
        }
    }

    /** Probe Anthropic minimal sur le modelId exact (POST /messages, max_tokens=1). */
    private boolean probeAnthropicModel(String baseUrl, String apiKey, String modelId) {
        RestClient client = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("x-api-key", apiKey)
                .defaultHeader("anthropic-version", "2023-06-01")
                .defaultHeader("Content-Type", "application/json")
                .requestFactory(new org.springframework.http.client.SimpleClientHttpRequestFactory() {{
                    setConnectTimeout(10_000);
                    setReadTimeout(30_000);
                }})
                .build();
        Map<String, Object> body = Map.of(
                "model", modelId,
                "max_tokens", 1,
                "messages", List.of(Map.of("role", "user", "content", "ping"))
        );
        String response = client.post()
                .uri("/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);
        return response != null && response.contains("content");
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() <= 300 ? s : s.substring(0, 300) + "…";
    }

    /** Résultat d'un probe de disponibilité. */
    public record ProbeOutcome(boolean available, String error) {
        public static ProbeOutcome ok() { return new ProbeOutcome(true, null); }
        public static ProbeOutcome failed(String error) { return new ProbeOutcome(false, error); }
    }

    // ─── Catalogue live d'un provider (GET /models) ──────────────────────

    /**
     * Liste les modèles actuellement SERVIS par un provider (catalogue live),
     * pour que « Add a model » propose des IDs réels au lieu d'un champ libre.
     * Clé : celle fournie, sinon celle d'un modèle déjà configuré pour ce provider.
     */
    public List<AiCatalogModelDto> listProviderModels(String provider, String apiKey, String baseUrl) {
        validateProvider(provider);
        validateBaseUrl(baseUrl);
        String resolvedBase = resolveBaseUrl(provider, baseUrl);
        String key = (apiKey != null && !apiKey.isBlank()) ? apiKey : resolveExistingKey(provider);
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException(
                    "Aucune clé API pour " + provider + " — renseigne la clé pour charger le catalogue.");
        }
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(resolvedBase)
                .requestFactory(new org.springframework.http.client.SimpleClientHttpRequestFactory() {{
                    setConnectTimeout(10_000);
                    setReadTimeout(30_000);
                }});
        if ("anthropic".equals(provider)) {
            builder.defaultHeader("x-api-key", key).defaultHeader("anthropic-version", "2023-06-01");
        } else {
            builder.defaultHeader("Authorization", "Bearer " + key);
        }
        RestClient client = builder.build();
        org.springframework.web.client.ResourceAccessException ioErr = null;
        // 2 tentatives : une erreur I/O (DNS/connexion) est souvent transitoire.
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                ModelsListResponse resp = client.get().uri("/models").retrieve().body(ModelsListResponse.class);
                if (resp == null || resp.data() == null) return List.of();
                return resp.data().stream()
                        .map(ModelEntry::id)
                        .filter(id -> id != null && !id.isBlank())
                        .distinct()
                        .sorted()
                        .map(id -> new AiCatalogModelDto(id, categorize(id)))
                        .toList();
            } catch (HttpClientErrorException e) {
                throw new IllegalArgumentException("Catalogue " + provider + " indisponible : HTTP "
                        + e.getStatusCode().value() + " (clé invalide ou endpoint /models absent ?)");
            } catch (org.springframework.web.client.ResourceAccessException e) {
                ioErr = e;
            }
        }
        String detail = ioErr.getMostSpecificCause() != null
                ? ioErr.getMostSpecificCause().getMessage() : ioErr.getMessage();
        throw new IllegalArgumentException("Provider " + provider
                + " injoignable depuis le serveur (réseau/DNS) : " + detail
                + ". Réessaie ; si ça persiste, vérifie l'accès Internet/DNS du conteneur pms-server "
                + "(tu peux aussi saisir l'ID du modèle à la main).");
    }

    /**
     * Clé réutilisable pour un provider, sans la redemander à l'utilisateur :
     * d'abord un modèle plateforme déjà configuré, sinon la connexion BYOK de
     * l'org du demandeur. Retourne null si rien n'est réutilisable.
     */
    private String resolveReusableKey(String provider, Long orgId) {
        String platformKey = resolveExistingKey(provider);
        if (platformKey != null && !platformKey.isBlank()) {
            return platformKey;
        }
        if (orgId != null) {
            return orgAiApiKeyRepository.findByOrganizationIdAndProvider(orgId, provider)
                    .filter(OrgAiApiKey::isValid)
                    .map(OrgAiApiKey::getApiKey)
                    .filter(k -> k != null && !k.isBlank())
                    .orElse(null);
        }
        return null;
    }

    private String resolveExistingKey(String provider) {
        return modelRepository.findAll().stream()
                .filter(m -> provider.equals(m.getProvider()))
                .map(PlatformAiModel::getApiKey)
                .filter(k -> k != null && !k.isBlank())
                .findFirst()
                .orElse(null);
    }

    /**
     * Catégorie heuristique d'un modèle d'après son ID (les endpoints /models ne
     * donnent pas de tags). Guide le choix « quel modèle pour quel agent ».
     */
    static String categorize(String id) {
        String s = id.toLowerCase();
        if (s.contains("coder") || s.contains("-code") || s.contains("code-")) return "code";
        if (s.contains("ocr")) return "ocr";
        if (s.contains("rerank")) return "rerank";
        if (s.contains("embed")) return "embedding";
        if (s.contains("tts") || s.contains("speech") || s.contains("voice") || s.contains("audio")
                || s.contains("parakeet") || s.contains("riva") || s.contains("canary")
                || s.contains("whisper")) return "audio";
        if (s.contains("diffusion") || s.contains("sdxl") || s.contains("stable-diffusion")
                || s.contains("flux") || s.contains("sana")) return "image";
        if (s.contains("guard") || s.contains("safety") || s.contains("shield")) return "safety";
        if (s.contains("vila") || s.contains("vision") || s.contains("nvclip") || s.contains("-vl-")
                || s.endsWith("-vl") || s.contains("maverick")) return "vision";
        if (s.contains("reason") || s.contains("-r1") || s.contains("qwq") || s.contains("think")
                || s.contains("deepseek-r")) return "reasoning";
        if (s.contains("instruct") || s.contains("chat") || s.contains("llama") || s.contains("nemotron")
                || s.contains("mistral") || s.contains("mixtral") || s.contains("qwen") || s.contains("gemma")
                || s.contains("phi") || s.contains("minimax") || s.contains("kimi") || s.contains("glm")) return "chat";
        return "other";
    }

    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    record ModelsListResponse(List<ModelEntry> data) {}

    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    record ModelEntry(String id) {}

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
