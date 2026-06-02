package com.clenzy.controller;

import com.clenzy.service.WaitlistService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

/**
 * Webhook entrant Brevo : desinscriptions / hard bounces / plaintes.
 *
 * <h2>Securite</h2>
 * Endpoint public (sous /api/public/** = permitAll). Protege par un token partage
 * optionnel ({@code brevo.webhook-secret}) passe en query (?token=...). Configurez
 * l'URL du webhook cote Brevo avec ce token. Si le secret n'est pas defini, les
 * events sont acceptes mais un avertissement est logge — a definir en prod.
 *
 * <h2>Effet</h2>
 * Marque l'inscription waitlist correspondante comme desinscrite (opt-out RGPD).
 * Brevo a deja desinscrit le contact ; on enregistre l'etat cote Clenzy pour ne
 * jamais le re-cibler.
 */
@RestController
@RequestMapping("/api/public/webhooks/brevo")
public class PublicBrevoWebhookController {

    private static final Logger log = LoggerFactory.getLogger(PublicBrevoWebhookController.class);

    /** Events Brevo valant une desinscription / suppression. */
    private static final Set<String> OPT_OUT_EVENTS = Set.of(
            "unsubscribe", "unsubscribed", "hard_bounce", "hardbounce", "spam", "blocked", "complaint");

    private final WaitlistService waitlistService;

    @Value("${brevo.webhook-secret:}")
    private String webhookSecret;

    public PublicBrevoWebhookController(WaitlistService waitlistService) {
        this.waitlistService = waitlistService;
    }

    @PostMapping
    public ResponseEntity<Void> receive(@RequestParam(value = "token", required = false) String token,
                                        @RequestBody(required = false) Map<String, Object> payload) {
        if (webhookSecret != null && !webhookSecret.isBlank()) {
            if (token == null || !webhookSecret.equals(token)) {
                log.warn("Webhook Brevo rejete : token invalide.");
                return ResponseEntity.status(401).build();
            }
        } else {
            log.warn("Webhook Brevo recu sans secret configure (brevo.webhook-secret) — a securiser en prod.");
        }

        if (payload == null) return ResponseEntity.ok().build();

        String event = str(payload.get("event"));
        String email = str(payload.get("email"));
        if (event != null && email != null && OPT_OUT_EVENTS.contains(event.toLowerCase())) {
            try {
                waitlistService.markUnsubscribed(email);
            } catch (Exception e) {
                log.warn("Webhook Brevo : maj desinscription KO pour {} : {}", email, e.getMessage());
            }
        }
        return ResponseEntity.ok().build();
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
