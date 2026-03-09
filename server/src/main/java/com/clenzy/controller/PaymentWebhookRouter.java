package com.clenzy.controller;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.service.PaymentMethodConfigService;
import com.clenzy.service.PaymentOrchestrationService;
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

    @Value("${stripe.webhook-secret:}")
    private String stripeWebhookSecret;

    public PaymentWebhookRouter(PaymentOrchestrationService orchestrationService,
                                 PaymentMethodConfigService configService) {
        this.orchestrationService = orchestrationService;
        this.configService = configService;
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
     * PayTabs webhook handler (stub — requires HMAC-SHA256 signature validation).
     */
    @PostMapping("/paytabs")
    public ResponseEntity<String> handlePayTabsWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "signature", required = false) String signature) {

        if (signature == null || signature.isBlank()) {
            log.warn("PayTabs webhook received without signature — rejecting");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("Missing signature");
        }

        // TODO: Implement HMAC-SHA256 signature verification when PayTabs goes live
        // String secret = configService.decryptWebhookSecret(paytabsConfig);
        // if (!verifyHmacSha256(payload, signature, secret)) { return 401; }

        log.info("Received PayTabs webhook (stub — signature present but not yet verified)");
        return ResponseEntity.ok("OK");
    }

    /**
     * CMI webhook handler (stub — requires hash-based signature validation).
     */
    @PostMapping("/cmi")
    public ResponseEntity<String> handleCmiWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-CMI-Signature", required = false) String signature) {

        if (signature == null || signature.isBlank()) {
            log.warn("CMI webhook received without signature — rejecting");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("Missing signature");
        }

        // TODO: Implement CMI signature verification when CMI goes live
        log.info("Received CMI webhook (stub — signature present but not yet verified)");
        return ResponseEntity.ok("OK");
    }

    /**
     * Payzone webhook handler (stub — requires signature validation).
     */
    @PostMapping("/payzone")
    public ResponseEntity<String> handlePayzoneWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Payzone-Signature", required = false) String signature) {

        if (signature == null || signature.isBlank()) {
            log.warn("Payzone webhook received without signature — rejecting");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("Missing signature");
        }

        // TODO: Implement Payzone signature verification when Payzone goes live
        log.info("Received Payzone webhook (stub — signature present but not yet verified)");
        return ResponseEntity.ok("OK");
    }

    /**
     * PayPal webhook handler (stub — requires certificate-based signature validation).
     */
    @PostMapping("/paypal")
    public ResponseEntity<String> handlePayPalWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "PAYPAL-TRANSMISSION-SIG", required = false) String signature) {

        if (signature == null || signature.isBlank()) {
            log.warn("PayPal webhook received without signature — rejecting");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("Missing signature");
        }

        // TODO: Implement PayPal webhook signature verification when PayPal goes live
        // PayPal uses certificate-based verification with transmission ID, timestamp, etc.
        log.info("Received PayPal webhook (stub — signature present but not yet verified)");
        return ResponseEntity.ok("OK");
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
