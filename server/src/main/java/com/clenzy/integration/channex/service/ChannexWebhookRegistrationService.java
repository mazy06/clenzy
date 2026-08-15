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

    /**
     * Chemin du controller qui recoit les webhooks — cf.
     * {@code ChannexWebhookController}, {@code @RequestMapping("/api/webhooks/channex")}.
     * Toute URL de rappel doit s'y terminer, sinon Channex livre sur un 404.
     */
    static final String WEBHOOK_PATH = "/api/webhooks/channex";

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
     *
     * <p>Sautee quand {@code clenzy.channex.enabled=false} : une fois les
     * schedulers retires du contexte, c'est le dernier appel sortant automatique
     * — inutile de le laisser echouer au boot tant que l'acces au hub n'est pas
     * ouvert. L'endpoint admin {@code POST /api/integrations/channex/webhooks/ensure}
     * reste appelable a la main.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!props.isEnabled()) {
            log.info("ChannexWebhookRegistration: integration desactivee "
                + "(clenzy.channex.enabled=false), skip auto-registration");
            return;
        }
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
     * @return statut : {@code already_registered} (webhook existant et actif),
     *         {@code reactivated} (webhook existant remis en service),
     *         {@code created} (nouveau webhook, id retourne),
     *         {@code invalid_callback_url} ou {@code not_configured}.
     */
    public RegistrationResult ensureGlobalWebhook() {
        if (!isFullyConfigured()) {
            return new RegistrationResult("not_configured", null,
                "clenzy.channex.api-key et clenzy.channex.webhook-callback-url requis");
        }

        String callbackUrl = props.getWebhookCallbackUrl().trim();

        // Une URL sans le chemin du controller livre dans le vide : Channex
        // recoit un 404 et compte l'echec. C'est exactement ce qui s'est passe
        // sur le compte de certification, ou l'URL enregistree etait la racine
        // du tunnel ngrok — aucune livraison n'a jamais pu aboutir, et Channex
        // a fini par desactiver le webhook.
        if (!callbackUrl.endsWith(WEBHOOK_PATH)) {
            log.error("ChannexWebhookRegistration: callback URL '{}' ne finit pas par '{}' — "
                + "les livraisons tomberaient en 404", callbackUrl, WEBHOOK_PATH);
            return new RegistrationResult("invalid_callback_url", null,
                "L'URL de rappel doit se terminer par " + WEBHOOK_PATH
                    + " — sinon Channex livre dans le vide et desactive le webhook");
        }

        List<JsonNode> existing = channexClient.listWebhooks();
        for (JsonNode webhook : existing) {
            String url = webhook.path("attributes").path("callback_url").asText("");
            if (callbackUrl.equals(url)) {
                String id = webhook.path("id").asText(null);
                boolean active = webhook.path("attributes").path("is_active").asBoolean(false);
                if (!active) {
                    // Channex desactive un webhook dont les livraisons echouent.
                    // On le remet en service plutot que de renvoyer l'operateur
                    // vers le dashboard : « ensure » doit garantir, pas constater.
                    channexClient.activateWebhook(id, props.getWebhookEventMask(),
                        props.getWebhookSecret());
                    log.info("ChannexWebhookRegistration: webhook {} etait inactif, reactive", id);
                    return new RegistrationResult("reactivated", id,
                        "Webhook remis en service (il avait ete desactive cote Channex)");
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
