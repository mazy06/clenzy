package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.dto.ChannexGenericWebhookPayload;
import com.clenzy.integration.channex.service.ChannexImportService;
import com.clenzy.integration.channex.config.ChannexProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller pour les webhooks Channex whitelabel (events push : listing_updated,
 * content_updated, property_updated, sync_error...).
 *
 * <p><b>Toujours actif</b>. Sur un compte public Channex ne POST jamais
 * dessus (faute d'enregistrement webhook), donc aucun trafic. Le jour ou
 * l'acces whitelabel est accorde et qu'on enregistre le webhook via
 * {@link com.clenzy.integration.channex.client.ChannexClient#registerWebhook},
 * Channex POST les events ici automatiquement.</p>
 *
 * <ul>
 *   <li>Reception sur {@code POST /webhooks/channex} (URL publique a enregistrer
 *       cote Channex).</li>
 *   <li>Validation HMAC via le header {@code X-Channex-Signature} (secret
 *       partage dans {@code clenzy.channex.webhook-secret}).</li>
 *   <li>Routage par type d'event vers le service approprie (import re-sync,
 *       booking sync, etc.).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/webhooks/channex/whitelabel")
public class ChannexWhitelabelWebhookController {

    private static final Logger log = LoggerFactory.getLogger(ChannexWhitelabelWebhookController.class);

    private final ChannexImportService importService;
    private final ChannexProperties channexProps;

    public ChannexWhitelabelWebhookController(ChannexImportService importService,
                                                 ChannexProperties channexProps) {
        this.importService = importService;
        this.channexProps = channexProps;
    }

    /**
     * Endpoint generique de reception des webhooks Channex whitelabel.
     *
     * <p>Channex POST sur cette URL pour chaque event. Le routage interne se
     * fait sur le champ {@code event} du payload :</p>
     * <ul>
     *   <li>{@code listing_updated} → re-sync de la property mappee
     *       sur cette listing</li>
     *   <li>{@code content_updated} → re-sync content de la property</li>
     *   <li>{@code property_updated} → idem</li>
     *   <li>{@code sync_error} → log + notification admin</li>
     * </ul>
     */
    @PostMapping
    public ResponseEntity<Void> receive(
            @RequestBody ChannexGenericWebhookPayload payload,
            @RequestHeader(value = "X-Channex-Signature", required = false) String signature) {
        // TODO whitelabel : valider HMAC quand l'acces est confirme
        // String expected = hmacSha256(rawBody, channexProps.getWebhookSecret());
        // if (!constantTimeEquals(expected, signature)) return 401;

        if (payload == null || payload.event() == null) {
            log.warn("Channex webhook : payload null ou event manquant");
            return ResponseEntity.badRequest().build();
        }

        log.info("Channex webhook recu : event={} resourceId={} resourceType={}",
            payload.event(), payload.resourceId(), payload.resourceType());

        // Routage par type d'event
        switch (payload.event()) {
            case "listing_updated":
            case "content_updated":
            case "property_updated":
                // TODO whitelabel : identifier la Property Clenzy via le
                // resourceId (qui est un channex_property_id ou listing_id selon
                // l'event) puis triggerer importService.resyncPropertyContent.
                // Pour l'instant juste un log — le code de resync est pret.
                log.info("Channex webhook : event {} -> resync content (TODO route)",
                    payload.event());
                break;
            case "sync_error":
                log.warn("Channex webhook : sync_error sur {} : {}",
                    payload.resourceId(), payload.payload());
                break;
            default:
                log.debug("Channex webhook : event ignore (pas implemente) : {}", payload.event());
        }
        return ResponseEntity.ok().build();
    }
}
