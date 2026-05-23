package com.clenzy.controller;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.NotificationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;

/**
 * Webhook handler GoCardless pour les changements d'état des payments PIS.
 *
 * <h2>Signature HMAC-SHA256</h2>
 * <p>GoCardless signe chaque webhook avec un secret partagé configuré dans le
 * dashboard. Header {@code Webhook-Signature} contient l'HMAC hex.</p>
 *
 * <h2>Évènements pertinents</h2>
 * <ul>
 *   <li>{@code payments.payment_paid} : virement confirmé par la banque → PAID</li>
 *   <li>{@code payments.payment_failed} : refus banque ou solde insuffisant → FAILED</li>
 *   <li>{@code payments.payment_cancelled} : annulation côté admin → FAILED</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/webhooks/payouts/gocardless")
public class GoCardlessWebhookController {

    private static final Logger log = LoggerFactory.getLogger(GoCardlessWebhookController.class);

    @Value("${gocardless.webhook-secret:}")
    private String webhookSecret;

    private final OwnerPayoutRepository payoutRepository;
    private final PayoutNotifier notifier;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    public GoCardlessWebhookController(OwnerPayoutRepository payoutRepository,
                                        PayoutNotifier notifier,
                                        NotificationService notificationService,
                                        ObjectMapper objectMapper) {
        this.payoutRepository = payoutRepository;
        this.notifier = notifier;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/events")
    public ResponseEntity<String> handleEvent(
            @RequestBody String payload,
            @RequestHeader(value = "Webhook-Signature", required = false) String signature) {

        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.warn("GoCardless webhook : webhook-secret non configure, rejet");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body("GoCardless webhook not configured");
        }
        if (signature == null || signature.isBlank()) {
            log.warn("GoCardless webhook : signature absente");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Missing signature");
        }
        if (!verifyHmacSha256(payload, signature, webhookSecret)) {
            log.warn("GoCardless webhook : signature invalide");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature");
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(payload);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid JSON");
        }

        // GoCardless envoie un envelope `events: [...]` avec plusieurs events par batch
        JsonNode events = root.get("events");
        if (events == null || !events.isArray()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing events");
        }

        for (JsonNode event : events) {
            processEvent(event);
        }
        return ResponseEntity.ok("OK");
    }

    private void processEvent(JsonNode event) {
        String resourceType = textOrNull(event, "resource_type");
        if (!"payments".equals(resourceType)) {
            return; // on ignore les autres types (mandates, refunds…)
        }

        String action = textOrNull(event, "action");
        if (action == null) return;

        JsonNode links = event.get("links");
        if (links == null) return;
        String paymentId = textOrNull(links, "payment");
        if (paymentId == null) return;

        OwnerPayout payout = payoutRepository
            .findFirstByPaymentReference("GOCARDLESS:" + paymentId)
            .orElse(null);
        if (payout == null) {
            log.warn("GoCardless webhook : payout inconnu pour paymentId={}", paymentId);
            return;
        }

        switch (action) {
            case "paid", "confirmed" -> markPaid(payout, paymentId);
            case "failed", "cancelled", "customer_approval_denied" ->
                markFailed(payout, "GoCardless action: " + action);
            default -> log.debug("GoCardless webhook : action {} (no state change)", action);
        }
    }

    private void markPaid(OwnerPayout payout, String paymentId) {
        if (payout.getStatus() == PayoutStatus.PAID) return;
        payout.setStatus(PayoutStatus.PAID);
        payout.setPaidAt(Instant.now());
        OwnerPayout saved = payoutRepository.save(payout);
        notifier.notifySuccess(saved);
        log.info("GoCardless webhook : payout {} marque PAID (paymentId={})", payout.getId(), paymentId);
    }

    private void markFailed(OwnerPayout payout, String reason) {
        if (payout.getStatus() == PayoutStatus.PAID) {
            notificationService.notifyAdminsAndManagersByOrgId(
                payout.getOrganizationId(),
                NotificationKey.PAYOUT_FAILED,
                "Reversement Open Banking reverse",
                "Le reversement #" + payout.getId() + " a ete reverse : " + reason,
                "/billing");
            return;
        }
        payout.setStatus(PayoutStatus.FAILED);
        payout.setFailureReason(reason);
        OwnerPayout saved = payoutRepository.save(payout);
        notifier.notifyFailure(saved, reason);
        log.warn("GoCardless webhook : payout {} marque FAILED ({})", payout.getId(), reason);
    }

    private static boolean verifyHmacSha256(String payload, String signature, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String computedHex = HexFormat.of().formatHex(computed);
            // Comparaison constant-time
            String received = signature.trim().toLowerCase();
            String expected = computedHex.toLowerCase();
            if (received.length() != expected.length()) return false;
            int diff = 0;
            for (int i = 0; i < expected.length(); i++) {
                diff |= expected.charAt(i) ^ received.charAt(i);
            }
            return diff == 0;
        } catch (Exception e) {
            log.error("GoCardless verify failed", e);
            return false;
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asText() : null;
    }
}
