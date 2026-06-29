package com.clenzy.service;

import com.clenzy.config.ai.AiProvider;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.config.ai.BedrockProvider;
import com.clenzy.config.ai.OpenAiProvider;
import com.clenzy.model.AiFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Routes les requetes IA vers le bon provider en fonction de la cible resolue par
 * {@link AiTargetResolver}.
 *
 * Logique (source de verite unique = config DB, plus aucune cle env) :
 * - ORGANIZATION → utilise le provider effectif avec la cle BYOK de l'org
 * - PLATFORM_DB  → utilise le provider configure en DB par le SUPER_ADMIN
 *                   (peut etre different du provider demande — ex: demande "anthropic" mais
 *                    la plateforme utilise "bedrock" comme fallback gratuit)
 */
@Service
public class AiProviderRouter {

    private static final Logger log = LoggerFactory.getLogger(AiProviderRouter.class);

    private final AiTargetResolver aiTargetResolver;
    private final OpenAiProvider openAiProvider;
    private final AnthropicProvider anthropicProvider;
    private final BedrockProvider bedrockProvider;

    public AiProviderRouter(AiTargetResolver aiTargetResolver,
                            OpenAiProvider openAiProvider,
                            AnthropicProvider anthropicProvider,
                            BedrockProvider bedrockProvider) {
        this.aiTargetResolver = aiTargetResolver;
        this.openAiProvider = openAiProvider;
        this.anthropicProvider = anthropicProvider;
        this.bedrockProvider = bedrockProvider;
    }

    /**
     * Resout la cible et dispatch la requete vers le bon provider.
     *
     * @param orgId             ID de l'organisation
     * @param preferredProvider provider prefere ("openai" ou "anthropic")
     * @param request           requete LLM
     * @return resultat avec la reponse, le nom du provider utilise, et la source
     */
    public RoutedResponse route(Long orgId, String preferredProvider, AiRequest request) {
        return route(orgId, preferredProvider, null, request);
    }

    /**
     * Route avec resolution du modele specifique a la feature.
     */
    public RoutedResponse route(Long orgId, String preferredProvider, AiFeature feature, AiRequest request) {
        ResolvedTarget target = aiTargetResolver.resolve(orgId, preferredProvider, feature);

        // Platform DB — provider configure par le SUPER_ADMIN
        if (target.source() == KeySource.PLATFORM_DB) {
            return routeViaPlatformDb(target, request, orgId);
        }

        // ORGANIZATION (BYOK) — provider EFFECTIF resolu (peut differer du provider demande
        // quand une feature a un override provider connecte assigne en Settings > IA).
        // Fallback sur preferredProvider par securite. PLATFORM_DB est traite plus haut ;
        // il n'existe plus de source a cle env (cf. KeySource).
        String effectiveProvider = target.provider() != null ? target.provider() : preferredProvider;
        AiProvider provider = getProvider(effectiveProvider);
        AiRequest resolved = target.model() != null ? request.overrideModel(target.model()) : request;
        AiResponse response = provider.chat(resolved, target.apiKey());

        return new RoutedResponse(response, provider.name(), target.source());
    }

    /**
     * Resout uniquement la cible (sans executer la requete).
     * Utile pour les services qui ont besoin de verifier le budget avant le route.
     */
    public ResolvedTarget resolveKey(Long orgId, String preferredProvider) {
        return aiTargetResolver.resolve(orgId, preferredProvider, null);
    }

    public ResolvedTarget resolveKey(Long orgId, String preferredProvider, AiFeature feature) {
        return aiTargetResolver.resolve(orgId, preferredProvider, feature);
    }

    /**
     * Route via le provider plateforme configure en DB.
     * Pour les providers OpenAI-compatibles (bedrock, nvidia, openai), on reutilise
     * BedrockProvider avec un RestClient dynamique (meme format /v1/chat/completions).
     * Pour Anthropic, on utilise le AnthropicProvider avec la cle BYOK.
     */
    private RoutedResponse routeViaPlatformDb(ResolvedTarget target, AiRequest request, Long orgId) {
        String effectiveProvider = target.provider();
        AiRequest resolved = target.model() != null ? request.overrideModel(target.model()) : request;

        log.debug("Routed to platform DB provider {} for org={}", effectiveProvider, orgId);

        if ("anthropic".equals(effectiveProvider)) {
            AiResponse response = anthropicProvider.chat(resolved, target.apiKey(), target.baseUrl());
            return new RoutedResponse(response, effectiveProvider, target.source());
        }

        // OpenAI-compatible providers (bedrock, nvidia, openai) :
        // Use BedrockProvider with the target's apiKey (it builds a one-shot RestClient)
        // BedrockProvider already handles the OpenAI-compatible format
        AiResponse response = bedrockProvider.chat(resolved, target.apiKey(), target.baseUrl(), effectiveProvider);
        return new RoutedResponse(response, effectiveProvider, target.source());
    }

    private AiProvider getProvider(String providerName) {
        return switch (providerName) {
            case "openai" -> openAiProvider;
            case "anthropic" -> anthropicProvider;
            case "bedrock" -> bedrockProvider;
            default -> throw new IllegalArgumentException("Unknown AI provider: " + providerName);
        };
    }

    public record RoutedResponse(AiResponse response, String providerName, KeySource source) {}
}
