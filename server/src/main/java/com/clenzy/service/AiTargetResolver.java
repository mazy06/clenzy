package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiModelAvailability;
import com.clenzy.model.PlatformAiFeatureModel;
import com.clenzy.model.PlatformAiFeatureProvider;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import com.clenzy.repository.PlatformAiFeatureProviderRepository;
import com.clenzy.repository.PlatformAiModelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Résolveur UNIQUE de cible IA (provider + modèle + clé + baseUrl) à partir de la config DB
 * plateforme. Remplace les deux résolveurs parallèles historiques {@code AiKeyResolver} (one-shot)
 * et {@code AssistantTargetResolver} (streaming) : une seule implémentation des primitives de
 * lookup (BYOK, modèle assigné à la feature, modèle utilisable du catalogue), donc aucune dérive
 * possible.
 *
 * <p><b>SOURCE DE VÉRITÉ UNIQUE</b> = la config plateforme en base. Plus aucune clé/modèle par
 * défaut en variable d'environnement.</p>
 *
 * <p>Deux modes de consommation (mêmes primitives dessous), avec des politiques légitimement
 * différentes — ce ne sont PAS deux mécanismes, juste deux vues :</p>
 * <ul>
 *   <li>{@link #resolve} — <b>one-shot</b> : une cible, échec = {@code AiNotConfiguredException}
 *       (l'appelant notifie/affiche l'indisponibilité). Les exceptions de lookup se propagent.</li>
 *   <li>{@link #resolvePrimary} / {@link #resolveChain} — <b>streaming</b> (assistant/superviseur) :
 *       cible primaire à échec gracieux (cible à clé null) + chaîne de failover ordonnée. Les
 *       exceptions de lookup sont avalées par étape (fail-safe).</li>
 * </ul>
 */
@Service
public class AiTargetResolver {

    private static final Logger log = LoggerFactory.getLogger(AiTargetResolver.class);

    private final OrgAiApiKeyRepository orgAiApiKeyRepository;
    private final PlatformAiFeatureModelRepository platformAiFeatureModelRepository;
    private final PlatformAiFeatureProviderRepository platformAiFeatureProviderRepository;
    private final PlatformAiModelRepository platformAiModelRepository;
    private final AiProperties aiProperties;

    public AiTargetResolver(OrgAiApiKeyRepository orgAiApiKeyRepository,
                            PlatformAiFeatureModelRepository platformAiFeatureModelRepository,
                            PlatformAiFeatureProviderRepository platformAiFeatureProviderRepository,
                            PlatformAiModelRepository platformAiModelRepository,
                            AiProperties aiProperties) {
        this.orgAiApiKeyRepository = orgAiApiKeyRepository;
        this.platformAiFeatureModelRepository = platformAiFeatureModelRepository;
        this.platformAiFeatureProviderRepository = platformAiFeatureProviderRepository;
        this.platformAiModelRepository = platformAiModelRepository;
        this.aiProperties = aiProperties;
    }

    // ─── Mode one-shot (ex-AiKeyResolver) ───────────────────────────────────

    /**
     * Résout la cible pour une feature « one-shot » (design, pricing, sentiment, messaging,
     * analytics, content…). Précédence : provider effectif (override connecté de la feature) →
     * BYOK org → modèle assigné à la feature (utilisable) → premier modèle utilisable du catalogue
     * → {@code AiNotConfiguredException}.
     *
     * <p>Les exceptions de lookup se PROPAGENT (pas de fail-safe) : l'appelant gère l'indisponibilité.</p>
     */
    public ResolvedTarget resolve(Long organizationId, String requestedProvider, AiFeature feature) {
        final String effective = effectiveProvider(requestedProvider, feature);

        // 1. Clé BYOK de l'org pour le provider effectif (baseUrl par défaut du provider = null ici).
        Optional<ResolvedTarget> byok = byokTarget(organizationId, effective, null, null);
        if (byok.isPresent()) {
            log.debug("Cible BYOK org={} provider={}", organizationId, effective);
            return byok.get();
        }

        // 2. Modèle assigné à la feature (config plateforme), s'il est utilisable.
        Optional<ResolvedTarget> featureModel = featureModelTarget(feature, null);
        if (featureModel.isPresent()) {
            return featureModel.get();
        }

        // 3. Repli SOURCE UNIQUE : n'importe quel modèle configuré et utilisable.
        Optional<ResolvedTarget> any = anyUsableTarget();
        if (any.isPresent()) {
            log.warn("Feature {} : modèle assigné indisponible/absent → repli sur le modèle configuré {} ({})",
                    feature, any.get().model(), any.get().provider());
            return any.get();
        }

        // 4. Aucun modèle exploitable.
        throw new AiNotConfiguredException(
                "AI_NOT_CONFIGURED", effective,
                "Aucun modèle IA configuré et disponible. Configurez ou activez un modèle dans Paramètres > IA.");
    }

    // ─── Mode streaming (ex-AssistantTargetResolver) ────────────────────────

    /**
     * Cible primaire streaming pour une feature (assistant = {@code ASSISTANT_CHAT}). Précédence :
     * provider connecté assigné à la feature + BYOK → modèle plateforme assigné (utilisable) → BYOK
     * Anthropic → cible gracieuse à clé null. Le {@code contextModelOverride} (briefings) prime à
     * chaque étape. Les exceptions de lookup sont AVALÉES par étape (fail-safe).
     */
    public ResolvedTarget resolvePrimary(Long organizationId, AiFeature feature, String contextModelOverride) {
        final String ctxModel = (contextModelOverride != null && !contextModelOverride.isBlank())
                ? contextModelOverride : null;

        // 1. Provider connecté assigné à la feature → BYOK de l'org pour ce provider.
        try {
            Optional<String> assigned = platformAiFeatureProviderRepository.findByFeature(feature.name())
                    .map(PlatformAiFeatureProvider::getProvider);
            if (assigned.isPresent()) {
                String provider = assigned.get();
                Optional<ResolvedTarget> byok = byokTarget(organizationId, provider, ctxModel, defaultBaseUrl(provider));
                if (byok.isPresent()) {
                    return byok.get();
                }
                // Sans BYOK pour le provider assigné : pas de repli env → on passe à l'étape 2.
            }
        } catch (Exception e) {
            log.debug("resolvePrimary: lookup provider assigné échoué : {}", e.getMessage());
        }

        // 2. Modèle plateforme assigné à la feature (utilisable).
        try {
            Optional<ResolvedTarget> featureModel = featureModelTarget(feature, ctxModel);
            if (featureModel.isPresent()) {
                return featureModel.get();
            }
        } catch (Exception e) {
            log.debug("resolvePrimary: lookup modèle plateforme échoué : {}", e.getMessage());
        }

        // 3. Clé BYOK Anthropic de l'org (repli canonique, baseUrl null).
        try {
            Optional<ResolvedTarget> byokAnthropic = byokTarget(organizationId, "anthropic", ctxModel, null);
            if (byokAnthropic.isPresent()) {
                return byokAnthropic.get();
            }
        } catch (Exception e) {
            log.debug("resolvePrimary: lookup BYOK Anthropic échoué : {}", e.getMessage());
        }

        // 4. Aucune config exploitable : cible à clé/modèle null. Le chat provider renvoie une
        //    erreur explicite (« aucun modèle/clé configuré »). source=PLATFORM_DB (budget enforcé).
        return new ResolvedTarget("anthropic", ctxModel, null, null, KeySource.PLATFORM_DB);
    }

    /**
     * Chaîne de basculement (failover) : cible primaire ({@link #resolvePrimary}) suivie des replis
     * canoniques disponibles (Anthropic puis OpenAI, hors provider primaire), uniquement ceux ayant
     * une clé utilisable. Le {@code contextModelOverride} n'est PAS propagé aux replis.
     */
    public List<ResolvedTarget> resolveChain(Long organizationId, AiFeature feature, String contextModelOverride) {
        List<ResolvedTarget> chain = new ArrayList<>(3);
        ResolvedTarget primary = resolvePrimary(organizationId, feature, contextModelOverride);
        chain.add(primary);
        String primaryProvider = canonical(primary.provider());
        for (String provider : List.of("anthropic", "openai")) {
            if (provider.equals(primaryProvider)) continue;
            ResolvedTarget alt = providerFallback(organizationId, provider);
            if (alt != null) chain.add(alt);
        }
        return chain;
    }

    // ─── Primitives partagées (nues : pas de try/catch — la politique d'exception est portée
    //     par les méthodes publiques : resolve PROPAGE, resolvePrimary/resolveChain AVALENT) ─────

    /** Provider effectif = override connecté assigné à la feature, sinon provider demandé. */
    private String effectiveProvider(String requestedProvider, AiFeature feature) {
        if (feature == null) {
            return requestedProvider;
        }
        return platformAiFeatureProviderRepository.findByFeature(feature.name())
                .map(PlatformAiFeatureProvider::getProvider)
                .orElse(requestedProvider);
    }

    /** Modèle utilisable : clé non vide ET non marqué UNAVAILABLE par le monitoring. */
    private boolean isUsable(PlatformAiModel m) {
        return m != null && m.getApiKey() != null && !m.getApiKey().isBlank()
                && m.getAvailabilityStatus() != AiModelAvailability.UNAVAILABLE;
    }

    /**
     * Cible BYOK org pour un provider. Le modèle vient du {@code ctxModel} (briefings) sinon du
     * {@code modelOverride} de la clé.
     *
     * <p><b>Source de vérité unique</b> : les providers exigent un modèle (plus de défaut env). Une
     * clé BYOK SANS modèle (pas de modelOverride et pas de ctxModel) n'est donc pas exploitable telle
     * quelle → on l'ignore (Optional vide) pour retomber sur le modèle assigné à la feature (ou le
     * catalogue), au lieu de produire une cible à modèle null qui ferait échouer le provider (500).</p>
     */
    private Optional<ResolvedTarget> byokTarget(Long organizationId, String provider, String ctxModel, String baseUrl) {
        if (organizationId == null) {
            return Optional.empty();
        }
        return orgAiApiKeyRepository.findByOrganizationIdAndProvider(organizationId, provider)
                .filter(k -> k.isValid() && k.getApiKey() != null && !k.getApiKey().isBlank())
                .map(k -> {
                    String model = (ctxModel != null && !ctxModel.isBlank()) ? ctxModel : k.getModelOverride();
                    if (model == null || model.isBlank()) {
                        return null; // BYOK incomplète (sans modèle) → ignorée, fallback feature/catalogue
                    }
                    return new ResolvedTarget(provider, model, k.getApiKey(), baseUrl, KeySource.ORGANIZATION);
                });
    }

    /** Cible du modèle assigné à la feature, s'il est utilisable. {@code ctxModel} prime sinon le modelId. */
    private Optional<ResolvedTarget> featureModelTarget(AiFeature feature, String ctxModel) {
        if (feature == null) {
            return Optional.empty();
        }
        return platformAiFeatureModelRepository.findByFeature(feature.name())
                .map(PlatformAiFeatureModel::getModel)
                .filter(this::isUsable)
                .map(m -> new ResolvedTarget(m.getProvider(),
                        ctxModel != null ? ctxModel : m.getModelId(),
                        m.getApiKey(), m.getBaseUrl(), KeySource.PLATFORM_DB));
    }

    /** Premier modèle utilisable du catalogue (aucun filtre provider, ordre du repository). */
    private Optional<ResolvedTarget> anyUsableTarget() {
        return platformAiModelRepository.findAll().stream()
                .filter(this::isUsable)
                .findFirst()
                .map(m -> new ResolvedTarget(m.getProvider(), m.getModelId(), m.getApiKey(),
                        m.getBaseUrl(), KeySource.PLATFORM_DB));
    }

    /** Premier modèle plateforme utilisable pour un provider donné (failover, equalsIgnoreCase). */
    private Optional<ResolvedTarget> usableModelByProvider(String provider) {
        return platformAiModelRepository.findAll().stream()
                .filter(m -> provider.equalsIgnoreCase(m.getProvider()))
                .filter(this::isUsable)
                .findFirst()
                .map(m -> new ResolvedTarget(provider, m.getModelId(), m.getApiKey(),
                        m.getBaseUrl(), KeySource.PLATFORM_DB));
    }

    /**
     * Cible de repli pour un provider canonique : BYOK org → modèle plateforme utilisable → null.
     * Le {@code ctxModel} n'est PAS appliqué (replis). Exceptions avalées par étape (fail-safe streaming).
     */
    private ResolvedTarget providerFallback(Long organizationId, String provider) {
        try {
            Optional<ResolvedTarget> byok = byokTarget(organizationId, provider, null, defaultBaseUrl(provider));
            if (byok.isPresent()) {
                return byok.get();
            }
        } catch (Exception e) {
            log.debug("resolveChain: lookup BYOK {} échoué : {}", provider, e.getMessage());
        }
        try {
            Optional<ResolvedTarget> model = usableModelByProvider(provider);
            if (model.isPresent()) {
                return model.get();
            }
        } catch (Exception e) {
            log.debug("resolveChain: lookup modèle plateforme {} échoué : {}", provider, e.getMessage());
        }
        return null;
    }

    /** Nom de provider canonique : null/blank/anthropic → "anthropic", sinon minuscule. */
    private static String canonical(String provider) {
        if (provider == null || provider.isBlank()) {
            return "anthropic";
        }
        return provider.toLowerCase();
    }

    /** Base URL par défaut d'un provider connecté (les modèles plateforme portent la leur). */
    private String defaultBaseUrl(String provider) {
        return switch (provider) {
            case "openai" -> aiProperties.getOpenai().getBaseUrl();
            case "anthropic" -> aiProperties.getAnthropic().getBaseUrl();
            default -> null;
        };
    }
}
