package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.repository.OrgAiApiKeyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service central de resolution des cles API IA.
 *
 * Logique de priorite :
 * 1. Si l'organisation a une cle propre valide → l'utiliser (BYOK)
 * 2. Sinon → fallback sur la cle plateforme (env var)
 * 3. Si aucune cle disponible → throw AiNotConfiguredException
 */
@Service
public class AiKeyResolver {

    private static final Logger log = LoggerFactory.getLogger(AiKeyResolver.class);

    private final AiProperties aiProperties;
    private final OrgAiApiKeyRepository orgAiApiKeyRepository;

    public AiKeyResolver(AiProperties aiProperties, OrgAiApiKeyRepository orgAiApiKeyRepository) {
        this.aiProperties = aiProperties;
        this.orgAiApiKeyRepository = orgAiApiKeyRepository;
    }

    /**
     * Resout la cle API a utiliser pour l'organisation et le provider donnes.
     *
     * @param organizationId ID de l'organisation
     * @param providerName   nom du provider ("openai" ou "anthropic")
     * @return ResolvedKey avec la cle, le model override eventuel, et la source
     * @throws AiNotConfiguredException si aucune cle n'est disponible
     */
    public ResolvedKey resolve(Long organizationId, String providerName) {
        // 1. Check org-level key (BYOK)
        if (organizationId != null) {
            Optional<OrgAiApiKey> orgKey = orgAiApiKeyRepository
                    .findByOrganizationIdAndProvider(organizationId, providerName);

            if (orgKey.isPresent() && orgKey.get().isValid()
                    && orgKey.get().getApiKey() != null && !orgKey.get().getApiKey().isBlank()) {
                OrgAiApiKey key = orgKey.get();
                log.debug("Using org-level API key for org={} provider={}", organizationId, providerName);
                return new ResolvedKey(key.getApiKey(), key.getModelOverride(), KeySource.ORGANIZATION);
            }
        }

        // 2. Fallback to platform key
        String platformKey = getPlatformKey(providerName);
        if (platformKey != null && !platformKey.isBlank()) {
            return new ResolvedKey(platformKey, null, KeySource.PLATFORM);
        }

        // 3. No key available
        throw new AiNotConfiguredException(
                "AI_NOT_CONFIGURED",
                providerName,
                "Aucune cle API " + providerName + " n'est configuree. "
                        + "Configurez votre cle dans les parametres ou contactez l'administrateur."
        );
    }

    private String getPlatformKey(String providerName) {
        return switch (providerName) {
            case "openai" -> aiProperties.getOpenai().getApiKey();
            case "anthropic" -> aiProperties.getAnthropic().getApiKey();
            default -> throw new IllegalArgumentException("Unknown AI provider: " + providerName);
        };
    }

    // ─── Value Objects ──────────────────────────────────────────────────

    public record ResolvedKey(String apiKey, String modelOverride, KeySource source) {}

    public enum KeySource {
        /** Cle partagee de la plateforme (env var) */
        PLATFORM,
        /** Cle propre de l'organisation (BYOK) */
        ORGANIZATION
    }
}
