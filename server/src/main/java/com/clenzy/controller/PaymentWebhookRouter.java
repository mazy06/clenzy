package com.clenzy.controller;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.provider.CmiHashService;
import com.clenzy.payment.provider.PayPalPaymentProvider;
import com.clenzy.payment.provider.PayTabsPaymentProvider;
import com.clenzy.payment.provider.PayzonePaymentProvider;
import com.clenzy.service.PaymentMethodConfigService;
import com.clenzy.service.PaymentOrchestrationService;
import com.clenzy.service.PaymentTransactionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Unified webhook router for all payment providers.
 * Each endpoint validates the provider-specific signature before processing.
 *
 * Security: These endpoints are publicly accessible (no Spring Security auth)
 * because payment providers call them directly. Authentication is performed
 * via cryptographic signature verification specific to each provider.
 */
@RestController
@RequestMapping("/api/webhooks/payments")
public class PaymentWebhookRouter {

    private static final Logger log = LoggerFactory.getLogger(PaymentWebhookRouter.class);

    private final PaymentOrchestrationService orchestrationService;
    private final PaymentMethodConfigService configService;
    private final PayTabsPaymentProvider payTabsProvider;
    private final PayzonePaymentProvider payzoneProvider;
    private final PayPalPaymentProvider payPalProvider;
    private final CmiHashService cmiHashService;
    private final PaymentTransactionService paymentTransactionService;
    private final ObjectMapper objectMapper;

    @Value("${stripe.webhook-secret:}")
    private String stripeWebhookSecret;

    public PaymentWebhookRouter(PaymentOrchestrationService orchestrationService,
                                 PaymentMethodConfigService configService,
                                 PayTabsPaymentProvider payTabsProvider,
                                 PayzonePaymentProvider payzoneProvider,
                                 PayPalPaymentProvider payPalProvider,
                                 CmiHashService cmiHashService,
                                 PaymentTransactionService paymentTransactionService,
                                 ObjectMapper objectMapper) {
        this.orchestrationService = orchestrationService;
        this.configService = configService;
        this.payTabsProvider = payTabsProvider;
        this.payzoneProvider = payzoneProvider;
        this.payPalProvider = payPalProvider;
        this.cmiHashService = cmiHashService;
        this.paymentTransactionService = paymentTransactionService;
        this.objectMapper = objectMapper;
    }

    /**
     * Stripe webhook handler with signature verification.
     * Validates the Stripe-Signature header using the webhook secret,
     * then delegates to the orchestration service for transaction updates.
     */
    @PostMapping("/stripe")
    public ResponseEntity<String> handleStripeWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String signature) {

        // 1. Require signature header
        if (signature == null || signature.isBlank()) {
            log.warn("Stripe webhook received without signature header — rejecting");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("Missing Stripe-Signature header");
        }

        // 2. Verify signature using Stripe SDK
        Event event;
        try {
            event = Webhook.constructEvent(payload, signature, stripeWebhookSecret);
        } catch (SignatureVerificationException e) {
            log.warn("Stripe webhook signature verification failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("Invalid signature");
        } catch (Exception e) {
            log.error("Stripe webhook parsing error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("Invalid payload");
        }

        log.info("Stripe webhook verified: type={}, id={}", event.getType(), event.getId());

        // 3. Route based on event type — update PaymentTransaction via orchestrator
        try {
            processStripeEvent(event);
        } catch (Exception e) {
            log.error("Error processing Stripe webhook event {}: {}", event.getId(), e.getMessage());
            // Return 200 to prevent Stripe retries for processing errors
            // The transaction state will be reconciled by other mechanisms
        }

        return ResponseEntity.ok("OK");
    }

    /**
     * PayTabs IPN webhook handler.
     *
     * <h2>Flow</h2>
     * <ol>
     *   <li>Parse le payload pour extraire {@code cart_id} (= notre
     *       {@code transactionRef}) — non security-sensitive, sert juste de
     *       cle de lookup.</li>
     *   <li>Resout la {@link PaymentTransaction} → en deduit l'orgId →
     *       charge la config PayTabs de cette org → lit le Server Key.</li>
     *   <li>Verifie la signature HMAC-SHA256 du payload brut avec ce Server
     *       Key via {@link PayTabsPaymentProvider#verifyWebhook}.</li>
     *   <li>Si signature valide ET {@code response_status == "A"} (approved)
     *       → {@code orchestrationService.completeTransaction}.</li>
     *   <li>Si {@code response_status} in {@code "D"} (declined) ou
     *       {@code "E"} (error) → {@code failTransaction}.</li>
     * </ol>
     *
     * <h2>Securite</h2>
     * <p>Sans signature valide, on rejette avec 401 sans modifier la
     * transaction. La lecture initiale du {@code cart_id} avant signature
     * est acceptable car ce champ n'autorise aucune action — uniquement la
     * resolution du secret de verification.</p>
     */
    @PostMapping("/paytabs")
    public ResponseEntity<String> handlePayTabsWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "signature", required = false) String signature) {

        if (signature == null || signature.isBlank()) {
            log.warn("PayTabs webhook received without signature — rejecting");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Missing signature");
        }

        // 1. Parse pour resoudre la transaction (cart_id = transactionRef)
        JsonNode root;
        try {
            root = objectMapper.readTree(payload);
        } catch (Exception e) {
            log.warn("PayTabs webhook : payload invalide ({})", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid JSON");
        }
        String cartId = textOrNull(root, "cart_id");
        if (cartId == null || cartId.isBlank()) {
            log.warn("PayTabs webhook : cart_id absent — rejet");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing cart_id");
        }

        PaymentTransaction tx = paymentTransactionService.findByTransactionRef(cartId).orElse(null);
        if (tx == null) {
            log.warn("PayTabs webhook : transaction inconnue cart_id={}", cartId);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Unknown transaction");
        }

        // 2. Charger la config PayTabs de l'org pour avoir le Server Key
        PaymentMethodConfig config = configService.getOrCreateConfig(
            tx.getOrganizationId(), PaymentProviderType.PAYTABS);
        String serverKey = configService.decryptApiKey(config);
        if (serverKey == null || serverKey.isBlank()) {
            log.error("PayTabs webhook : server_key manquant pour org {}", tx.getOrganizationId());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Server key missing");
        }

        // 3. Verification de signature (HMAC-SHA256 du payload brut)
        if (!payTabsProvider.verifyWebhook(payload, signature, serverKey)) {
            log.warn("PayTabs webhook : signature invalide pour cart_id={}", cartId);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature");
        }

        // 4. Routage selon le statut de paiement
        String status = root.has("payment_result")
            ? textOrNull(root.get("payment_result"), "response_status") : null;
        if ("A".equals(status)) {
            orchestrationService.completeTransaction(cartId);
            log.info("PayTabs webhook : transaction {} confirmee", cartId);
        } else if ("D".equals(status) || "E".equals(status)) {
            String message = root.has("payment_result")
                ? textOrNull(root.get("payment_result"), "response_message") : "Payment declined";
            orchestrationService.failTransaction(cartId, "PayTabs " + status + ": " + message);
            log.info("PayTabs webhook : transaction {} echouee ({})", cartId, status);
        } else {
            log.warn("PayTabs webhook : status non gere pour cart_id={} : {}", cartId, status);
        }
        return ResponseEntity.ok("OK");
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asText() : null;
    }

    /**
     * CMI webhook handler.
     *
     * <h2>Format CMI</h2>
     * <p>CMI poste un {@code application/x-www-form-urlencoded} (formulaire,
     * pas du JSON) avec une vingtaine de champs ({@code clientid},
     * {@code oid}, {@code ProcReturnCode}, {@code Response}, {@code HASH},
     * etc.). Le {@code HASH} de verification est <strong>dans le body</strong>,
     * pas dans un header — d'ou {@code @RequestParam Map<String, String>}
     * pour binder l'ensemble des champs.</p>
     *
     * <h2>Verification de signature</h2>
     * <p>Recalcule un SHA-512 sur la concatenation ordonnee des valeurs des
     * champs (selon la specification CMI) + storekey, puis compare avec
     * {@code params.get("HASH")}. La logique sera deleguee a
     * {@code CmiPaymentProvider.verifyWebhook()} en PR4.</p>
     */
    @PostMapping(value = "/cmi", consumes = "application/x-www-form-urlencoded")
    public ResponseEntity<String> handleCmiWebhook(@RequestParam Map<String, String> params) {
        String hash = params.get("HASH");
        if (hash == null || hash.isBlank()) {
            log.warn("CMI webhook received without HASH field — rejecting");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Missing HASH");
        }
        String oid = params.get("oid");
        if (oid == null || oid.isBlank()) {
            log.warn("CMI webhook received without oid (transaction ref) — rejecting");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing oid");
        }

        // 1. Resoudre la transaction → orgId pour charger le store_key adequat
        PaymentTransaction tx = paymentTransactionService.findByTransactionRef(oid).orElse(null);
        if (tx == null) {
            log.warn("CMI webhook : transaction inconnue oid={}", oid);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Unknown transaction");
        }

        // 2. Charger la config CMI pour avoir le store_key
        PaymentMethodConfig config = configService.getOrCreateConfig(
            tx.getOrganizationId(), PaymentProviderType.CMI);
        String storeKey = configService.decryptApiSecret(config);
        if (storeKey == null || storeKey.isBlank()) {
            log.error("CMI webhook : store_key absent pour org {}", tx.getOrganizationId());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Store key missing");
        }

        // 3. Verification du hash SHA-512 ver3 sur les params bruts
        if (!cmiHashService.verifyHash(params, storeKey)) {
            log.warn("CMI webhook : HASH invalide pour oid={}", oid);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid HASH");
        }

        // 4. Routage selon le statut
        // CMI : ProcReturnCode = "00" pour succes, autre code = echec
        String procReturnCode = params.get("ProcReturnCode");
        String response = params.get("Response");
        if ("00".equals(procReturnCode) && "Approved".equalsIgnoreCase(response)) {
            orchestrationService.completeTransaction(oid);
            log.info("CMI webhook : transaction {} confirmee", oid);
        } else {
            String errorMessage = params.getOrDefault("ErrMsg",
                "CMI " + procReturnCode + ": " + (response != null ? response : "rejected"));
            orchestrationService.failTransaction(oid, errorMessage);
            log.info("CMI webhook : transaction {} echouee ({}, {})", oid, procReturnCode, response);
        }
        return ResponseEntity.ok("OK");
    }

    /**
     * Payzone webhook handler.
     *
     * <h2>Flow (similaire à PayTabs)</h2>
     * <ol>
     *   <li>Parse le payload JSON pour extraire {@code merchant_reference}
     *       (= notre {@code transactionRef}).</li>
     *   <li>Lookup la {@code PaymentTransaction} → orgId → charge le
     *       {@code webhook_secret} de cette org.</li>
     *   <li>Vérifie la signature HMAC-SHA256 via
     *       {@link PayzonePaymentProvider#verifyWebhook}.</li>
     *   <li>Si signature valide ET {@code status == "completed"} →
     *       {@code completeTransaction}, sinon {@code failTransaction}.</li>
     * </ol>
     */
    @PostMapping("/payzone")
    public ResponseEntity<String> handlePayzoneWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Payzone-Signature", required = false) String signature) {

        if (signature == null || signature.isBlank()) {
            log.warn("Payzone webhook received without signature — rejecting");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Missing signature");
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(payload);
        } catch (Exception e) {
            log.warn("Payzone webhook : payload invalide ({})", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid JSON");
        }
        String merchantRef = textOrNull(root, "merchant_reference");
        if (merchantRef == null || merchantRef.isBlank()) {
            log.warn("Payzone webhook : merchant_reference absent");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing merchant_reference");
        }

        PaymentTransaction tx = paymentTransactionService.findByTransactionRef(merchantRef).orElse(null);
        if (tx == null) {
            log.warn("Payzone webhook : transaction inconnue ref={}", merchantRef);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Unknown transaction");
        }

        PaymentMethodConfig config = configService.getOrCreateConfig(
            tx.getOrganizationId(), PaymentProviderType.PAYZONE);
        String webhookSecret = configService.decryptWebhookSecret(config);
        // Fallback : si webhookSecret pas configuré séparément, utiliser l'api_key
        // (certains providers utilisent la même clé pour API et webhook signing).
        if (webhookSecret == null || webhookSecret.isBlank()) {
            webhookSecret = configService.decryptApiKey(config);
        }
        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.error("Payzone webhook : secret absent pour org {}", tx.getOrganizationId());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Webhook secret missing");
        }

        if (!payzoneProvider.verifyWebhook(payload, signature, webhookSecret)) {
            log.warn("Payzone webhook : signature invalide pour ref={}", merchantRef);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature");
        }

        String status = textOrNull(root, "status");
        if ("completed".equalsIgnoreCase(status) || "succeeded".equalsIgnoreCase(status)) {
            orchestrationService.completeTransaction(merchantRef);
            log.info("Payzone webhook : transaction {} confirmee", merchantRef);
        } else if ("failed".equalsIgnoreCase(status) || "declined".equalsIgnoreCase(status)
                || "cancelled".equalsIgnoreCase(status)) {
            String reason = textOrNull(root, "failure_reason");
            orchestrationService.failTransaction(merchantRef,
                "Payzone " + status + (reason != null ? ": " + reason : ""));
            log.info("Payzone webhook : transaction {} echouee ({})", merchantRef, status);
        } else {
            log.warn("Payzone webhook : status non gere pour ref={} : {}", merchantRef, status);
        }
        return ResponseEntity.ok("OK");
    }

    /**
     * PayPal webhook handler.
     *
     * <h2>Spécificités PayPal</h2>
     * <p>PayPal ne signe pas avec un HMAC partagé — la verification stricte
     * passe par un appel API à
     * {@code POST /v1/notifications/verify-webhook-signature} avec les
     * headers PayPal-Transmission-* et le payload + le webhook_id de l'org.</p>
     *
     * <p>Vérification stricte via {@link PayPalPaymentProvider#verifyWebhookStrict}
     * (appel API verify-webhook-signature). L'ancien mode « soft »
     * ({@code verifyWebhook}) est désormais fail-closed et ne doit plus être
     * utilisé (Z3-SEC-03).</p>
     *
     * <h2>Évènement attendu</h2>
     * <p>{@code PAYMENT.CAPTURE.COMPLETED} : capture validée. Le
     * {@code resource.supplementary_data.related_ids.order_id} contient
     * notre order PayPal ; le {@code resource.custom_id} ou le
     * {@code purchase_units[0].reference_id} contient notre
     * {@code transactionRef}.</p>
     */
    @PostMapping("/paypal")
    public ResponseEntity<String> handlePayPalWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "PAYPAL-AUTH-ALGO",        required = false) String authAlgo,
            @RequestHeader(value = "PAYPAL-CERT-URL",         required = false) String certUrl,
            @RequestHeader(value = "PAYPAL-TRANSMISSION-ID",  required = false) String transmissionId,
            @RequestHeader(value = "PAYPAL-TRANSMISSION-SIG", required = false) String transmissionSig,
            @RequestHeader(value = "PAYPAL-TRANSMISSION-TIME",required = false) String transmissionTime) {

        // Validation des headers requis pour la vérification API PayPal
        if (transmissionSig == null || transmissionSig.isBlank()
            || transmissionId == null || transmissionId.isBlank()
            || transmissionTime == null || transmissionTime.isBlank()
            || authAlgo == null || authAlgo.isBlank()
            || certUrl == null || certUrl.isBlank()) {
            log.warn("PayPal webhook : headers de signature incomplets — rejet");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Missing PayPal headers");
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(payload);
        } catch (Exception e) {
            log.warn("PayPal webhook : payload invalide ({})", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid JSON");
        }

        String eventType = textOrNull(root, "event_type");
        // On gère uniquement les événements de capture pour MVP.
        if (eventType == null || !eventType.startsWith("PAYMENT.CAPTURE.")) {
            log.debug("PayPal webhook : event_type {} ignoré (hors scope MVP)", eventType);
            return ResponseEntity.ok("OK");
        }

        String transactionRef = extractPayPalReferenceId(root);
        if (transactionRef == null) {
            log.warn("PayPal webhook : reference_id absent dans le payload");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing reference_id");
        }

        PaymentTransaction tx = paymentTransactionService.findByTransactionRef(transactionRef).orElse(null);
        if (tx == null) {
            log.warn("PayPal webhook : transaction inconnue ref={}", transactionRef);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Unknown transaction");
        }

        // Vérification stricte via API PayPal /v1/notifications/verify-webhook-signature
        var headers = new com.clenzy.payment.provider.PayPalClient.PayPalWebhookHeaders(
            authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime);
        if (!payPalProvider.verifyWebhookStrict(headers, payload, tx.getOrganizationId())) {
            log.warn("PayPal webhook : verification API echouee pour ref={}", transactionRef);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid webhook signature");
        }

        if ("PAYMENT.CAPTURE.COMPLETED".equals(eventType)) {
            orchestrationService.completeTransaction(transactionRef);
            log.info("PayPal webhook : transaction {} confirmee", transactionRef);
        } else if ("PAYMENT.CAPTURE.DENIED".equals(eventType)
                || "PAYMENT.CAPTURE.DECLINED".equals(eventType)
                || "PAYMENT.CAPTURE.REVERSED".equals(eventType)) {
            orchestrationService.failTransaction(transactionRef, "PayPal " + eventType);
            log.info("PayPal webhook : transaction {} echouee ({})", transactionRef, eventType);
        } else {
            log.debug("PayPal webhook : event {} ignore (non final)", eventType);
        }
        return ResponseEntity.ok("OK");
    }

    /** Extrait notre transactionRef du payload PayPal multi-shapes. */
    private static String extractPayPalReferenceId(JsonNode root) {
        // Tentative 1 : resource.custom_id (si on l'a passé à la création)
        JsonNode resource = root.get("resource");
        if (resource == null) return null;
        String customId = textOrNull(resource, "custom_id");
        if (customId != null && !customId.isBlank()) return customId;
        // Tentative 2 : resource.purchase_units[0].reference_id (Orders v2)
        JsonNode purchaseUnits = resource.get("purchase_units");
        if (purchaseUnits != null && purchaseUnits.isArray() && purchaseUnits.size() > 0) {
            String refId = textOrNull(purchaseUnits.get(0), "reference_id");
            if (refId != null && !refId.isBlank()) return refId;
        }
        // Tentative 3 : invoice_id ou note_to_payer (cas edge)
        String invoiceId = textOrNull(resource, "invoice_id");
        return invoiceId != null && !invoiceId.isBlank() ? invoiceId : null;
    }

    // ─── Internal Stripe Event Processing ───────────────────────────────────────

    private void processStripeEvent(Event event) {
        String eventType = event.getType();

        switch (eventType) {
            case "checkout.session.completed",
                 "checkout.session.async_payment_succeeded" -> {
                // Extract transactionRef from metadata
                String transactionRef = extractTransactionRef(event);
                if (transactionRef != null) {
                    orchestrationService.completeTransaction(transactionRef);
                    log.info("Marked transaction {} as COMPLETED via Stripe webhook", transactionRef);
                }
            }
            case "checkout.session.async_payment_failed",
                 "payment_intent.payment_failed" -> {
                String transactionRef = extractTransactionRef(event);
                if (transactionRef != null) {
                    orchestrationService.failTransaction(transactionRef,
                        "Payment failed (Stripe event: " + eventType + ")");
                    log.info("Marked transaction {} as FAILED via Stripe webhook", transactionRef);
                }
            }
            default -> log.debug("Unhandled Stripe event type in webhook router: {}", eventType);
        }
    }

    /**
     * Extract the transactionRef from Stripe event metadata.
     * The orchestrator stores transactionRef in the checkout session metadata.
     */
    private String extractTransactionRef(Event event) {
        try {
            var deserializer = event.getDataObjectDeserializer();
            if (deserializer.getObject().isPresent()) {
                var obj = deserializer.getObject().get();
                if (obj instanceof com.stripe.model.checkout.Session session) {
                    Map<String, String> metadata = session.getMetadata();
                    if (metadata != null) {
                        return metadata.get("transactionRef");
                    }
                } else if (obj instanceof com.stripe.model.PaymentIntent pi) {
                    Map<String, String> metadata = pi.getMetadata();
                    if (metadata != null) {
                        return metadata.get("transactionRef");
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to extract transactionRef from Stripe event: {}", e.getMessage());
        }
        return null;
    }
}
