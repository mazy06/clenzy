package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexProperties;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Auto-registration du webhook GLOBAL Channex — jusqu'ici {@code registerWebhook}
 * existait dans le client mais n'etait JAMAIS appele : l'enregistrement etait
 * une etape manuelle du dashboard Channex, oubliable a chaque nouvel
 * environnement (= plus aucun event entrant, silencieusement).
 *
 * <p>Idempotent : {@code GET /webhooks} d'abord — si un webhook pointe deja sur
 * notre callback URL, on ne recree rien. Declenche au boot (si la config est
 * complete) et a la demande via l'endpoint admin
 * {@code POST /api/integrations/channex/webhooks/ensure}.</p>
 *
 * <p>Pre-requis config ({@code clenzy.channex.*}) : {@code api-key},
 * {@code webhook-callback-url} (URL publique du controller) et
 * {@code webhook-secret} (valeur du header {@code X-Channex-Token}, validee
 * en entree par ChannexSignatureValidator).</p>
 */
@Service
public class ChannexWebhookRegistrationService {

    private static final Logger log = LoggerFactory.getLogger(ChannexWebhookRegistrationService.class);

    private final ChannexClient channexClient;
    private final ChannexProperties props;

    public ChannexWebhookRegistrationService(ChannexClient channexClient, ChannexProperties props) {
        this.channexClient = channexClient;
        this.props = props;
    }

    /**
     * Verification au demarrage : best-effort, une erreur (Channex down, clé
     * invalide) ne doit jamais empecher le boot — l'endpoint admin permet de
     * re-tenter, et le webhook existant continue de fonctionner.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!isFullyConfigured()) {
            log.info("ChannexWebhookRegistration: config incomplete (api-key/callback-url), skip auto-registration");
            return;
        }
        try {
            RegistrationResult result = ensureGlobalWebhook();
            log.info("ChannexWebhookRegistration: boot check → {}", result.status());
        } catch (Exception e) {
            log.warn("ChannexWebhookRegistration: verification au boot KO (re-tentable via "
                + "POST /api/integrations/channex/webhooks/ensure) : {}", e.getMessage());
        }
    }

    /**
     * Garantit qu'un webhook global pointe sur notre callback URL.
     *
     * @return statut : {@code already_registered} (webhook existant sur la meme
     *         URL), {@code created} (nouveau webhook, id retourne), ou
     *         {@code not_configured}.
     */
    public RegistrationResult ensureGlobalWebhook() {
        if (!isFullyConfigured()) {
            return new RegistrationResult("not_configured", null,
                "clenzy.channex.api-key et clenzy.channex.webhook-callback-url requis");
        }

        String callbackUrl = props.getWebhookCallbackUrl().trim();

        List<JsonNode> existing = channexClient.listWebhooks();
        for (JsonNode webhook : existing) {
            String url = webhook.path("attributes").path("callback_url").asText("");
            if (callbackUrl.equals(url)) {
                String id = webhook.path("id").asText(null);
                boolean active = webhook.path("attributes").path("is_active").asBoolean(false);
                if (!active) {
                    // is_active=false (defaut Channex piege) : webhook muet — on le
                    // signale explicitement plutot que de le doublonner.
                    log.warn("ChannexWebhookRegistration: webhook {} existe mais is_active=false — "
                        + "l'activer dans le dashboard Channex ou le supprimer puis relancer /ensure", id);
                    return new RegistrationResult("exists_inactive", id,
                        "Webhook existant mais inactif cote Channex — activation requise");
                }
                return new RegistrationResult("already_registered", id, null);
            }
        }

        String id = channexClient.registerGlobalWebhook(
            callbackUrl, props.getWebhookEventMask(), props.getWebhookSecret());
        return new RegistrationResult("created", id, null);
    }

    private boolean isFullyConfigured() {
        return props.isConfigured()
            && props.getWebhookCallbackUrl() != null
            && !props.getWebhookCallbackUrl().isBlank();
    }

    public record RegistrationResult(String status, String webhookId, String detail) {}
}
