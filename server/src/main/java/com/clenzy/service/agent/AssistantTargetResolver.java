package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.model.AiFeature;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.service.PlatformAiConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Resout la cible LLM de l'assistant : provider effectif, modele, cle API et base URL.
 *
 * <p>Extrait de {@code AgentOrchestrator} (refactor SRP) — comportement strictement
 * identique a l'ancien {@code resolveAssistantTarget}.</p>
 *
 * <p>Precedence (alignee sur {@link com.clenzy.service.AiKeyResolver}, appliquee a la
 * feature {@code ASSISTANT_CHAT}) :</p>
 * <ol>
 *   <li>Provider connecte assigne a la feature (Settings &gt; IA) → cle BYOK de l'org,
 *       sinon cle plateforme du provider</li>
 *   <li>Modele plateforme assigne a la feature → provider/cle/baseUrl/modele du modele
 *       (NVIDIA, Bedrock, OpenAI... tous OpenAI-compatibles)</li>
 *   <li>Cle BYOK Anthropic de l'org</li>
 *   <li>Defaut Anthropic plateforme (cle null → le provider utilise sa cle env)</li>
 * </ol>
 *
 * <p>Le {@code contextModelOverride} (briefings : Haiku) prime sur le modele resolu.
 * Fail-safe : toute exception de lookup degrade vers Anthropic par defaut.
 * La cle API n'est JAMAIS loggee.</p>
 */
@Component
public class AssistantTargetResolver {

    private static final Logger log = LoggerFactory.getLogger(AssistantTargetResolver.class);

    private final PlatformAiConfigService platformAiConfigService;
    private final OrgAiApiKeyRepository orgAiApiKeyRepository;
    private final AiProperties aiProperties;

    public AssistantTargetResolver(PlatformAiConfigService platformAiConfigService,
                                    OrgAiApiKeyRepository orgAiApiKeyRepository,
                                    AiProperties aiProperties) {
        this.platformAiConfigService = platformAiConfigService;
        this.orgAiApiKeyRepository = orgAiApiKeyRepository;
        this.aiProperties = aiProperties;
    }

    /** Cible LLM resolue pour l'assistant : provider + modele + cle + base URL. */
    public record ChatTarget(String provider, String model, String apiKey, String baseUrl) {}

    public ChatTarget resolve(Long organizationId, String contextModelOverride) {
        final String ctxModel = (contextModelOverride != null && !contextModelOverride.isBlank())
                ? contextModelOverride : null;

        // 1. Provider connecte assigne a ASSISTANT_CHAT (Settings > IA).
        try {
            Optional<String> assigned = platformAiConfigService
                    .getActiveProviderForFeature(AiFeature.ASSISTANT_CHAT.name());
            if (assigned.isPresent()) {
                String provider = assigned.get();
                Optional<OrgAiApiKey> byok = orgAiApiKeyRepository
                        .findByOrganizationIdAndProvider(organizationId, provider)
                        .filter(k -> k.isValid() && k.getApiKey() != null && !k.getApiKey().isBlank());
                if (byok.isPresent()) {
                    OrgAiApiKey k = byok.get();
                    return new ChatTarget(provider, ctxModel != null ? ctxModel : k.getModelOverride(),
                            k.getApiKey(), defaultBaseUrl(provider));
                }
                String envKey = platformEnvKey(provider);
                if (envKey != null && !envKey.isBlank()) {
                    return new ChatTarget(provider, ctxModel, envKey, defaultBaseUrl(provider));
                }
                // Provider assigne sans cle utilisable → on retombe sur la resolution par defaut.
            }
        } catch (Exception e) {
            log.debug("resolveAssistantTarget: lookup provider override echoue : {}", e.getMessage());
        }

        // 2. Modele plateforme assigne a ASSISTANT_CHAT.
        try {
            Optional<PlatformAiModel> model = platformAiConfigService
                    .getActiveModelForFeature(AiFeature.ASSISTANT_CHAT.name())
                    .filter(m -> m.getApiKey() != null && !m.getApiKey().isBlank());
            if (model.isPresent()) {
                PlatformAiModel m = model.get();
                return new ChatTarget(m.getProvider(), ctxModel != null ? ctxModel : m.getModelId(),
                        m.getApiKey(), m.getBaseUrl());
            }
        } catch (Exception e) {
            log.debug("resolveAssistantTarget: lookup modele plateforme echoue : {}", e.getMessage());
        }

        // 3. Cle BYOK Anthropic de l'org.
        try {
            Optional<OrgAiApiKey> anthropicByok = orgAiApiKeyRepository
                    .findByOrganizationIdAndProvider(organizationId, "anthropic")
                    .filter(k -> k.isValid() && k.getApiKey() != null && !k.getApiKey().isBlank());
            if (anthropicByok.isPresent()) {
                OrgAiApiKey k = anthropicByok.get();
                return new ChatTarget("anthropic", ctxModel != null ? ctxModel : k.getModelOverride(),
                        k.getApiKey(), null);
            }
        } catch (Exception e) {
            log.debug("resolveAssistantTarget: lookup BYOK Anthropic echoue : {}", e.getMessage());
        }

        // 4. Defaut Anthropic plateforme : cle null => AnthropicChatProvider utilise sa cle env.
        return new ChatTarget("anthropic", ctxModel, null, null);
    }

    /** Base URL par defaut d'un provider connecte (les modeles plateforme portent la leur). */
    private String defaultBaseUrl(String provider) {
        return switch (provider) {
            case "openai" -> aiProperties.getOpenai().getBaseUrl();
            case "anthropic" -> aiProperties.getAnthropic().getBaseUrl();
            default -> null;
        };
    }

    /** Cle plateforme (env var) d'un provider connecte. */
    private String platformEnvKey(String provider) {
        return switch (provider) {
            case "openai" -> aiProperties.getOpenai().getApiKey();
            case "anthropic" -> aiProperties.getAnthropic().getApiKey();
            default -> null;
        };
    }
}
