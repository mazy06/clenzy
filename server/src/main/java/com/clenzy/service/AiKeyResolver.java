package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.model.PlatformAiFeatureModel;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service central de resolution des cles API IA.
 *
 * Logique de priorite :
 * 1. Cle propre de l'organisation (BYOK) → KeySource.ORGANIZATION
 * 2. Modele plateforme assigne a la feature (DB) → KeySource.PLATFORM_DB
 * 3. Cle plateforme en env var            → KeySource.PLATFORM
 * 4. AiNotConfiguredException
 */
@Service
public class AiKeyResolver {

    private static final Logger log = LoggerFactory.getLogger(AiKeyResolver.class);

    private final AiProperties aiProperties;
    private final OrgAiApiKeyRepository orgAiApiKeyRepository;
    private final PlatformAiFeatureModelRepository platformAiFeatureModelRepository;

    public AiKeyResolver(AiProperties aiProperties,
                         OrgAiApiKeyRepository orgAiApiKeyRepository,
                         PlatformAiFeatureModelRepository platformAiFeatureModelRepository) {
        this.aiProperties = aiProperties;
        this.orgAiApiKeyRepository = orgAiApiKeyRepository;
        this.platformAiFeatureModelRepository = platformAiFeatureModelRepository;
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
        return resolve(organizationId, providerName, null);
    }

    /**
     * Resout la cle API avec le modele specifique a la feature.
     */
    public ResolvedKey resolve(Long organizationId, String providerName, AiFeature feature) {
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

        // 2. Fallback to platform feature model (DB)
        if (feature != null) {
            Optional<PlatformAiFeatureModel> featureModel = platformAiFeatureModelRepository
                    .findByFeature(feature.name());
            if (featureModel.isPresent()) {
                PlatformAiModel model = featureModel.get().getModel();
                if (model.getApiKey() != null && !model.getApiKey().isBlank()) {
                    log.debug("No {} org key, using platform feature model {} ({}/{}) for org={}",
                            providerName, model.getName(), model.getProvider(), model.getModelId(), organizationId);
                    return new ResolvedKey(model.getApiKey(), model.getModelId(),
                            KeySource.PLATFORM_DB, model.getProvider(), model.getBaseUrl());
                }
            }
        }

        // 3. Fallback to platform env vars (backward-compat)
        String platformKey = getPlatformEnvKey(providerName);
        if (platformKey != null && !platformKey.isBlank()) {
            return new ResolvedKey(platformKey, null, KeySource.PLATFORM, providerName, null);
        }

        // 4. No key available
        throw new AiNotConfiguredException(
                "AI_NOT_CONFIGURED",
                providerName,
                "Aucune cle API IA n'est configuree. "
                        + "Configurez un provider dans les parametres ou contactez l'administrateur."
        );
    }

    private String getPlatformEnvKey(String providerName) {
        return switch (providerName) {
            case "openai" -> aiProperties.getOpenai().getApiKey();
            case "anthropic" -> aiProperties.getAnthropic().getApiKey();
            default -> null;
        };
    }

    // ─── Value Objects ──────────────────────────────────────────────────

    /**
     * @param apiKey        cle API resolue
     * @param modelOverride modele custom (null = defaut du provider)
     * @param source        d'ou vient la cle
     * @param providerName  nom du provider effectif (peut differer du provider demande en cas de fallback)
     * @param baseUrl       URL de base du provider (null = utiliser le defaut du provider)
     */
    public record ResolvedKey(String apiKey, String modelOverride, KeySource source,
                              String providerName, String baseUrl) {

        /** Backward-compat constructor (sans providerName/baseUrl). */
        public ResolvedKey(String apiKey, String modelOverride, KeySource source) {
            this(apiKey, modelOverride, source, null, null);
        }
    }

    public enum KeySource {
        /** Cle partagee de la plateforme (env var) */
        PLATFORM,
        /** Cle propre de l'organisation (BYOK) */
        ORGANIZATION,
        /** Provider plateforme configure en DB par le SUPER_ADMIN */
        PLATFORM_DB
    }
}
