package com.clenzy.service;

import com.clenzy.config.ai.AiProvider;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.config.ai.BedrockProvider;
import com.clenzy.config.ai.OpenAiProvider;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiKeyResolver.KeySource;
import com.clenzy.service.AiKeyResolver.ResolvedKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Routes les requetes IA vers le bon provider en fonction de la resolution de cle.
 *
 * Logique :
 * - ORGANIZATION → utilise le provider demande avec la cle BYOK de l'org
 * - PLATFORM     → utilise le provider demande avec la cle env var
 * - PLATFORM_DB  → utilise le provider configure en DB par le SUPER_ADMIN
 *                   (peut etre different du provider demande — ex: demande "anthropic" mais
 *                    la plateforme utilise "bedrock" comme fallback gratuit)
 */
@Service
public class AiProviderRouter {

    private static final Logger log = LoggerFactory.getLogger(AiProviderRouter.class);

    private final AiKeyResolver aiKeyResolver;
    private final OpenAiProvider openAiProvider;
    private final AnthropicProvider anthropicProvider;
    private final BedrockProvider bedrockProvider;

    public AiProviderRouter(AiKeyResolver aiKeyResolver,
                            OpenAiProvider openAiProvider,
                            AnthropicProvider anthropicProvider,
                            BedrockProvider bedrockProvider) {
        this.aiKeyResolver = aiKeyResolver;
        this.openAiProvider = openAiProvider;
        this.anthropicProvider = anthropicProvider;
        this.bedrockProvider = bedrockProvider;
    }

    /**
     * Resout la cle et dispatch la requete vers le bon provider.
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
        ResolvedKey key = aiKeyResolver.resolve(orgId, preferredProvider, feature);

        // Platform DB — provider configure par le SUPER_ADMIN
        if (key.source() == KeySource.PLATFORM_DB) {
            return routeViaPlatformDb(key, request, orgId);
        }

        // ORGANIZATION or PLATFORM env var — utilise le provider demande
        AiProvider provider = getProvider(preferredProvider);
        AiRequest resolved = key.modelOverride() != null ? request.overrideModel(key.modelOverride()) : request;
        AiResponse response = (key.source() == KeySource.ORGANIZATION)
                ? provider.chat(resolved, key.apiKey())
                : provider.chat(resolved);

        return new RoutedResponse(response, provider.name(), key.source());
    }

    /**
     * Resout uniquement la cle (sans executer la requete).
     * Utile pour les services qui ont besoin de verifier le budget avant le route.
     */
    public ResolvedKey resolveKey(Long orgId, String preferredProvider) {
        return aiKeyResolver.resolve(orgId, preferredProvider);
    }

    public ResolvedKey resolveKey(Long orgId, String preferredProvider, AiFeature feature) {
        return aiKeyResolver.resolve(orgId, preferredProvider, feature);
    }

    /**
     * Route via le provider plateforme configure en DB.
     * Pour les providers OpenAI-compatibles (bedrock, nvidia, openai), on reutilise
     * BedrockProvider avec un RestClient dynamique (meme format /v1/chat/completions).
     * Pour Anthropic, on utilise le AnthropicProvider avec la cle BYOK.
     */
    private RoutedResponse routeViaPlatformDb(ResolvedKey key, AiRequest request, Long orgId) {
        String effectiveProvider = key.providerName();
        AiRequest resolved = key.modelOverride() != null ? request.overrideModel(key.modelOverride()) : request;

        log.debug("Routed to platform DB provider {} for org={}", effectiveProvider, orgId);

        if ("anthropic".equals(effectiveProvider)) {
            AiResponse response = anthropicProvider.chat(resolved, key.apiKey(), key.baseUrl());
            return new RoutedResponse(response, effectiveProvider, key.source());
        }

        // OpenAI-compatible providers (bedrock, nvidia, openai) :
        // Use BedrockProvider with the key's apiKey (it builds a one-shot RestClient)
        // BedrockProvider already handles the OpenAI-compatible format
        AiResponse response = bedrockProvider.chat(resolved, key.apiKey(), key.baseUrl(), effectiveProvider);
        return new RoutedResponse(response, effectiveProvider, key.source());
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
