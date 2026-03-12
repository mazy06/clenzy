package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.config.ai.OpenAiProvider;
import com.clenzy.dto.AiApiKeyTestResultDto;
import com.clenzy.dto.OrgAiApiKeyStatusDto;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.repository.OrgAiApiKeyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Gestion des cles API IA par organisation (BYOK).
 *
 * Permet a une organisation de :
 * - Voir le status de ses cles (masquees)
 * - Tester une cle avant de la sauvegarder
 * - Sauvegarder/mettre a jour une cle (chiffree via Jasypt)
 * - Supprimer une cle (retour a la cle plateforme)
 */
@Service
@Transactional
public class OrgAiApiKeyService {

    private static final Logger log = LoggerFactory.getLogger(OrgAiApiKeyService.class);
    private static final List<String> SUPPORTED_PROVIDERS = List.of("openai", "anthropic");

    private final OrgAiApiKeyRepository repository;
    private final AiProperties aiProperties;
    private final OpenAiProvider openAiProvider;
    private final AnthropicProvider anthropicProvider;

    public OrgAiApiKeyService(OrgAiApiKeyRepository repository,
                               AiProperties aiProperties,
                               OpenAiProvider openAiProvider,
                               AnthropicProvider anthropicProvider) {
        this.repository = repository;
        this.aiProperties = aiProperties;
        this.openAiProvider = openAiProvider;
        this.anthropicProvider = anthropicProvider;
    }

    /**
     * Retourne le status de chaque provider pour l'organisation.
     */
    @Transactional(readOnly = true)
    public List<OrgAiApiKeyStatusDto> getStatus(Long orgId) {
        List<OrgAiApiKey> orgKeys = repository.findByOrganizationId(orgId);
        List<OrgAiApiKeyStatusDto> result = new ArrayList<>();

        for (String provider : SUPPORTED_PROVIDERS) {
            Optional<OrgAiApiKey> orgKey = orgKeys.stream()
                    .filter(k -> provider.equals(k.getProvider()))
                    .findFirst();

            if (orgKey.isPresent()) {
                OrgAiApiKey key = orgKey.get();
                result.add(new OrgAiApiKeyStatusDto(
                        provider,
                        true,
                        key.getMaskedApiKey(),
                        key.getModelOverride(),
                        key.isValid(),
                        key.getLastValidatedAt(),
                        "ORGANIZATION"
                ));
            } else {
                // Check if platform key is available
                boolean platformConfigured = hasPlatformKey(provider);
                result.add(new OrgAiApiKeyStatusDto(
                        provider,
                        false,
                        null,
                        null,
                        platformConfigured,
                        null,
                        "PLATFORM"
                ));
            }
        }
        return result;
    }

    /**
     * Teste une cle API sans la sauvegarder.
     *
     * @param provider le provider a tester ("openai" ou "anthropic")
     * @param apiKey   la cle API a tester
     * @return resultat du test (success/failure + keyValid + message)
     */
    public AiApiKeyTestResultDto testKey(String provider, String apiKey) {
        validateProvider(provider);

        try {
            if ("openai".equals(provider)) {
                return testOpenAiKey(apiKey);
            } else {
                return testAnthropicKey(apiKey);
            }
        } catch (Exception e) {
            log.warn("API key test failed for provider={}: {}", provider, e.getMessage());
            return new AiApiKeyTestResultDto(false, false,
                    "Erreur de connexion au provider: " + e.getMessage(), provider);
        }
    }

    /**
     * Sauvegarde une cle API (teste d'abord, puis persiste si la cle est valide).
     * Autorise la sauvegarde meme si le compte manque de credits (la cle reste valide).
     *
     * @param orgId         ID de l'organisation
     * @param provider      le provider ("openai" ou "anthropic")
     * @param apiKey        la cle API complete
     * @param modelOverride modele personnalise (optionnel)
     * @return le status mis a jour
     */
    public OrgAiApiKeyStatusDto saveKey(Long orgId, String provider, String apiKey, String modelOverride) {
        validateProvider(provider);

        // Test the key first
        AiApiKeyTestResultDto testResult = testKey(provider, apiKey);

        // Reject only if the key itself is invalid (not for billing/quota issues)
        if (!testResult.keyValid()) {
            throw new IllegalArgumentException(testResult.message());
        }

        // Upsert the key (allowed if key is valid, even with billing issues)
        OrgAiApiKey entity = repository.findByOrganizationIdAndProvider(orgId, provider)
                .orElse(new OrgAiApiKey(orgId, provider, apiKey));

        entity.setApiKey(apiKey);
        entity.setModelOverride(modelOverride);
        entity.setValid(true);
        entity.setLastValidatedAt(LocalDateTime.now());

        entity = repository.save(entity);

        log.info("Saved AI API key for org={} provider={} keyValid={} success={}",
                orgId, provider, testResult.keyValid(), testResult.success());

        return new OrgAiApiKeyStatusDto(
                provider,
                true,
                entity.getMaskedApiKey(),
                entity.getModelOverride(),
                entity.isValid(),
                entity.getLastValidatedAt(),
                "ORGANIZATION"
        );
    }

    /**
     * Supprime la cle API de l'organisation pour un provider.
     * L'organisation reviendra a la cle plateforme.
     */
    public void deleteKey(Long orgId, String provider) {
        validateProvider(provider);
        repository.deleteByOrganizationIdAndProvider(orgId, provider);
        log.info("Deleted AI API key for org={} provider={}, reverting to platform key", orgId, provider);
    }

    // ─── Private helpers ─────────────────────────────────────────────────

    private AiApiKeyTestResultDto testOpenAiKey(String apiKey) {
        AiRequest request = AiRequest.withMaxTokens("You are a test assistant.", "Say OK", 5);

        try {
            AiResponse response = openAiProvider.chat(request, apiKey);
            if (response != null && response.content() != null) {
                return new AiApiKeyTestResultDto(true, true, "Cle OpenAI valide", "openai");
            }
            return new AiApiKeyTestResultDto(false, false, "Reponse vide du provider", "openai");
        } catch (AiProviderException e) {
            boolean keyValid = isKeyValidButAccountIssue(e);
            return new AiApiKeyTestResultDto(false, keyValid,
                    classifyProviderError("OpenAI", e), "openai");
        }
    }

    private AiApiKeyTestResultDto testAnthropicKey(String apiKey) {
        AiRequest request = AiRequest.withMaxTokens("You are a test assistant.", "Say OK", 5);

        try {
            AiResponse response = anthropicProvider.chat(request, apiKey);
            if (response != null && response.content() != null) {
                return new AiApiKeyTestResultDto(true, true, "Cle Anthropic valide", "anthropic");
            }
            return new AiApiKeyTestResultDto(false, false, "Reponse vide du provider", "anthropic");
        } catch (AiProviderException e) {
            boolean keyValid = isKeyValidButAccountIssue(e);
            return new AiApiKeyTestResultDto(false, keyValid,
                    classifyProviderError("Anthropic", e), "anthropic");
        }
    }

    /**
     * Determine si l'erreur indique que la cle est valide mais le compte a un probleme
     * (solde insuffisant, quota depasse, rate limit, surcharge temporaire).
     * Dans ces cas, la cle peut etre sauvegardee car elle s'est authentifiee correctement.
     */
    private boolean isKeyValidButAccountIssue(AiProviderException e) {
        String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
        return msg.contains("credit balance")
                || msg.contains("insufficient_quota")
                || msg.contains("billing")
                || msg.contains("429")
                || msg.contains("rate_limit")
                || msg.contains("too many requests")
                || msg.contains("overloaded")
                || msg.contains("529")
                || msg.contains("503");
    }

    /**
     * Classifie l'erreur du provider pour donner un message utilisateur clair.
     * Distingue : cle invalide, solde insuffisant, quota depasse, erreur reseau.
     */
    private String classifyProviderError(String providerLabel, AiProviderException e) {
        String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";

        if (msg.contains("credit balance") || msg.contains("insufficient_quota") || msg.contains("billing")) {
            return "Solde insuffisant sur votre compte " + providerLabel
                    + ". Ajoutez des credits API sur le site du fournisseur.";
        }
        if (msg.contains("401") || msg.contains("unauthorized") || msg.contains("invalid.*key")
                || msg.contains("invalid_api_key") || msg.contains("authentication")) {
            return "Cle " + providerLabel + " invalide. Verifiez que la cle est correcte.";
        }
        if (msg.contains("429") || msg.contains("rate_limit") || msg.contains("too many requests")) {
            return "Limite de requetes atteinte pour " + providerLabel
                    + ". Reessayez dans quelques instants.";
        }
        if (msg.contains("overloaded") || msg.contains("529") || msg.contains("503")) {
            return providerLabel + " est temporairement indisponible. Reessayez dans quelques instants.";
        }
        return "Erreur " + providerLabel + ": " + e.getMessage();
    }

    private boolean hasPlatformKey(String provider) {
        String key = switch (provider) {
            case "openai" -> aiProperties.getOpenai().getApiKey();
            case "anthropic" -> aiProperties.getAnthropic().getApiKey();
            default -> null;
        };
        return key != null && !key.isBlank();
    }

    private void validateProvider(String provider) {
        if (!SUPPORTED_PROVIDERS.contains(provider)) {
            throw new IllegalArgumentException("Provider non supporte: " + provider
                    + ". Valeurs acceptees: " + SUPPORTED_PROVIDERS);
        }
    }
}
