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

import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;

/**
 * Webhook handler Wise pour les évènements
 * {@code transfers#state-change}.
 *
 * <h2>Évènements de transfert</h2>
 * <p>Wise envoie un POST JSON quand le statut d'un transfer change.
 * États finaux pertinents :</p>
 * <ul>
 *   <li>{@code outgoing_payment_sent} : virement envoyé vers la banque
 *       destinataire → payout PAID côté Clenzy</li>
 *   <li>{@code funds_refunded} ou {@code charged_back} : refund → repasser
 *       le payout en FAILED pour permettre une investigation</li>
 *   <li>{@code cancelled} : transfer annulé → FAILED également</li>
 * </ul>
 *
 * <h2>Vérification de signature</h2>
 * <p>Wise signe chaque webhook avec sa clé privée. Le header
 * {@code X-Signature-SHA256} contient une signature RSA du body raw. On
 * vérifie avec la clé publique Wise (fixe par environnement, fournie dans
 * leur documentation).</p>
 *
 * <h2>Mapping vers nos payouts</h2>
 * <p>Le {@code paymentReference} de nos payouts contient {@code "WISE:" + transferId}
 * — on recherche par cette référence pour identifier le payout impacté.</p>
 */
@RestController
@RequestMapping("/api/webhooks/payouts/wise")
public class WiseWebhookController {

    private static final Logger log = LoggerFactory.getLogger(WiseWebhookController.class);

    /**
     * Clé publique Wise Sandbox (fixe, documentation publique).
     * Pour la production, remplacer par la clé publique prod fournie par Wise.
     */
    @Value("${wise.public-key:}")
    private String wisePublicKeyPem;

    private final OwnerPayoutRepository payoutRepository;
    private final PayoutNotifier notifier;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    public WiseWebhookController(OwnerPayoutRepository payoutRepository,
                                  PayoutNotifier notifier,
                                  NotificationService notificationService,
                                  ObjectMapper objectMapper) {
        this.payoutRepository = payoutRepository;
        this.notifier = notifier;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/transfers-state-change")
    public ResponseEntity<String> handleTransferStateChange(
            @RequestBody String payload,
            @RequestHeader(value = "X-Signature-SHA256", required = false) String signature) {

        // 1. Verification de signature RSA-SHA256 (recommandée en prod)
        if (wisePublicKeyPem != null && !wisePublicKeyPem.isBlank()) {
            if (signature == null || signature.isBlank()) {
                log.warn("Wise webhook : signature absente, rejet");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Missing signature");
            }
            if (!verifySignature(payload, signature)) {
                log.warn("Wise webhook : signature invalide");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature");
            }
        } else {
            log.warn("Wise webhook : vérification de signature désactivée (wise.public-key vide). À configurer en production.");
        }

        // 2. Parser le payload
        JsonNode root;
        try {
            root = objectMapper.readTree(payload);
        } catch (Exception e) {
            log.warn("Wise webhook : payload invalide ({})", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid JSON");
        }

        String eventType = textOrNull(root, "event_type");
        if (!"transfers#state-change".equals(eventType)) {
            log.debug("Wise webhook : event_type {} ignoré", eventType);
            return ResponseEntity.ok("OK");
        }

        JsonNode data = root.get("data");
        if (data == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing data");
        }

        // resource = { id, type, profile_id, account_id }
        JsonNode resource = data.get("resource");
        if (resource == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing data.resource");
        }
        String transferId = String.valueOf(resource.get("id").asLong());
        String currentState = textOrNull(data, "current_state");

        // 3. Lookup payout via paymentReference="WISE:<transferId>"
        OwnerPayout payout = payoutRepository
            .findFirstByPaymentReference("WISE:" + transferId)
            .orElse(null);
        if (payout == null) {
            log.warn("Wise webhook : payout inconnu pour transferId={}", transferId);
            // 200 OK quand même pour éviter les retries Wise sur des transferts hors-Clenzy
            return ResponseEntity.ok("Unknown transfer");
        }

        // 4. Mapping état Wise → état Clenzy
        switch (currentState != null ? currentState.toLowerCase() : "") {
            case "outgoing_payment_sent" -> markPaid(payout, transferId);
            case "funds_refunded", "charged_back", "cancelled", "bounced_back" ->
                markFailed(payout, "Wise state: " + currentState);
            default -> log.debug("Wise webhook : transferId={} state {} (no action)", transferId, currentState);
        }
        return ResponseEntity.ok("OK");
    }

    private void markPaid(OwnerPayout payout, String transferId) {
        if (payout.getStatus() == PayoutStatus.PAID) {
            log.debug("Wise webhook : payout {} deja PAID, idempotence", payout.getId());
            return;
        }
        payout.setStatus(PayoutStatus.PAID);
        payout.setPaidAt(Instant.now());
        OwnerPayout saved = payoutRepository.save(payout);
        notifier.notifySuccess(saved);
        log.info("Wise webhook : payout {} marque PAID (transferId={})", payout.getId(), transferId);
    }

    private void markFailed(OwnerPayout payout, String reason) {
        if (payout.getStatus() == PayoutStatus.PAID) {
            log.warn("Wise webhook : payout {} deja PAID, ignore state {}",
                payout.getId(), reason);
            // On notifie quand même les admins car c'est un cas anormal (refund/chargeback)
            notificationService.notifyAdminsAndManagersByOrgId(
                payout.getOrganizationId(),
                NotificationKey.PAYOUT_FAILED,
                "Reversement Wise reverse",
                "Le reversement #" + payout.getId() + " a ete reverse par Wise : " + reason,
                "/billing");
            return;
        }
        payout.setStatus(PayoutStatus.FAILED);
        payout.setFailureReason(reason);
        OwnerPayout saved = payoutRepository.save(payout);
        notifier.notifyFailure(saved, reason);
        log.warn("Wise webhook : payout {} marque FAILED ({})", payout.getId(), reason);
    }

    /**
     * Vérification RSA-SHA256 du body avec la clé publique Wise.
     * En cas d'erreur cryptographique, on retourne false.
     */
    private boolean verifySignature(String payload, String signatureBase64) {
        try {
            String pemCleaned = wisePublicKeyPem
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s+", "");
            byte[] keyBytes = Base64.getDecoder().decode(pemCleaned);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
            PublicKey publicKey = KeyFactory.getInstance("RSA").generatePublic(spec);

            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initVerify(publicKey);
            sig.update(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64.trim());
            return sig.verify(signatureBytes);
        } catch (Exception e) {
            log.error("Wise webhook : verifyRsa failed", e);
            return false;
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asText() : null;
    }
}
