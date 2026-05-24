package com.clenzy.config.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.client.HttpClientErrorException;

/**
 * Helper partage pour le traitement des erreurs HTTP des providers IA.
 *
 * <p>Centralise notamment la detection {@code 410 Gone} (modele EOL chez le
 * provider). Auparavant ce handler vivait uniquement dans {@link BedrockProvider}
 * — les modeles Anthropic ou OpenAI direct rataient le pretty-print et la
 * notification.</p>
 *
 * <p><b>Usage</b> dans un catch :</p>
 * <pre>
 *   try {
 *       // ... appel HTTP ...
 *   } catch (HttpClientErrorException.Gone e) {
 *       throw AiProviderErrorHandler.handleGone(eventPublisher, label, model, e);
 *   } catch (Exception e) {
 *       throw AiProviderErrorHandler.handleGeneric(label, e);
 *   }
 * </pre>
 */
public final class AiProviderErrorHandler {

    private static final Logger log = LoggerFactory.getLogger(AiProviderErrorHandler.class);

    private AiProviderErrorHandler() { /* static utility */ }

    /**
     * Traite un 410 Gone : log + publish event {@link AiModelDeprecatedEvent}
     * (le listener notifiera les SUPER_ADMIN avec dedup) puis lance une
     * {@link AiProviderException} avec un message d'action clair.
     *
     * @return l'exception a lancer (utilise {@code throw helper.handleGone(...)}
     *         pour que le compilateur sache que la branche termine)
     */
    public static AiProviderException handleGone(
            ApplicationEventPublisher eventPublisher,
            String providerLabel,
            String modelId,
            HttpClientErrorException.Gone cause
    ) {
        String providerMessage = cause.getResponseBodyAsString();
        log.warn("{} API: modele '{}' obsolete (410 Gone). Reponse: {}", providerLabel, modelId, providerMessage);
        if (eventPublisher != null) {
            eventPublisher.publishEvent(new AiModelDeprecatedEvent(providerLabel, modelId, providerMessage));
        }
        return new AiProviderException(
                providerLabel,
                "Le modele '" + modelId + "' n'est plus disponible chez " + providerLabel
                        + ". Selectionnez un nouveau modele dans Parametres > IA et sauvegardez.",
                cause
        );
    }

    /**
     * Traite une erreur generique : log + wrap dans une {@link AiProviderException}.
     * Equivalent du catch {@code Exception} d'avant — preserve le comportement
     * existant pour ne pas masquer les autres erreurs (timeout, 5xx, etc.).
     */
    public static AiProviderException handleGeneric(String providerLabel, Exception cause) {
        log.error("{} API call failed: {}", providerLabel, cause.getMessage());
        return new AiProviderException(providerLabel, "API call failed: " + cause.getMessage(), cause);
    }
}
