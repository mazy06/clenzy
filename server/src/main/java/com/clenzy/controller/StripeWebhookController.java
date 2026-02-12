package com.clenzy.controller;

import com.clenzy.service.InscriptionService;
import com.clenzy.service.StripeService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/webhooks/stripe")
public class StripeWebhookController {

    private static final Logger logger = LoggerFactory.getLogger(StripeWebhookController.class);

    private final StripeService stripeService;
    private final InscriptionService inscriptionService;

    @Value("${stripe.webhook-secret}")
    private String webhookSecret;

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    public StripeWebhookController(StripeService stripeService, InscriptionService inscriptionService) {
        this.stripeService = stripeService;
        this.inscriptionService = inscriptionService;
    }

    /**
     * Endpoint pour recevoir les webhooks Stripe
     * IMPORTANT: Cet endpoint ne doit PAS etre protege par Spring Security
     * car Stripe l'appelle directement.
     *
     * Gere deux types de paiements :
     * - Inscription (metadata.type = "inscription") : cree le compte utilisateur
     * - Intervention (metadata.intervention_id) : confirme le paiement de l'intervention
     */
    @PostMapping
    public ResponseEntity<String> handleStripeWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {

        // Initialiser Stripe
        Stripe.apiKey = stripeSecretKey;

        Event event;

        try {
            // Verifier la signature du webhook
            event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
        } catch (SignatureVerificationException e) {
            // Signature invalide
            logger.warn("Signature Stripe invalide");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("Signature invalide");
        } catch (Exception e) {
            logger.error("Erreur lors du traitement du webhook Stripe", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("Erreur lors du traitement du webhook: " + e.getMessage());
        }

        logger.info("Webhook Stripe recu: type={}", event.getType());

        // Traiter l'evenement
        switch (event.getType()) {
            case "checkout.session.completed":
                handleCheckoutCompleted(event);
                break;

            case "checkout.session.async_payment_succeeded":
                handleAsyncPaymentSucceeded(event);
                break;

            case "checkout.session.async_payment_failed":
                handleAsyncPaymentFailed(event);
                break;

            default:
                logger.debug("Evenement Stripe non gere: {}", event.getType());
                break;
        }

        return ResponseEntity.ok("Webhook traite avec succes");
    }

    /**
     * Gere l'evenement checkout.session.completed.
     * Systeme hybride :
     * - Inscription (mode SUBSCRIPTION, metadata.type = "inscription") : cree le compte + abonnement mensuel
     * - Intervention (mode PAYMENT, metadata.intervention_id) : paiement unique de l'intervention
     */
    private void handleCheckoutCompleted(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        Session session = null;

        // Tentative 1 : deserialisation standard (fonctionne si les versions API correspondent)
        if (deserializer.getObject().isPresent()) {
            session = (Session) deserializer.getObject().get();
            logger.info("Session deserialisee avec succes depuis l'evenement webhook");
        }

        // Tentative 2 : deserialisation unsafe (fonctionne meme avec des versions API differentes)
        if (session == null) {
            logger.warn("Deserialisation standard echouee, tentative avec deserializeUnsafe...");
            try {
                StripeObject obj = deserializer.deserializeUnsafe();
                if (obj instanceof Session) {
                    session = (Session) obj;
                    logger.info("Session deserialisee avec deserializeUnsafe");
                }
            } catch (Exception e) {
                logger.warn("deserializeUnsafe a echoue: {}", e.getMessage());
            }
        }

        // Tentative 3 : extraire le session ID du JSON brut et recuperer via l'API Stripe
        if (session == null) {
            logger.warn("Toutes les deserialisations ont echoue, extraction du session ID depuis le JSON brut...");
            try {
                String rawJson = deserializer.getRawJson();
                ObjectMapper mapper = new ObjectMapper();
                JsonNode jsonNode = mapper.readTree(rawJson);
                String sessionId = jsonNode.has("id") ? jsonNode.get("id").asText() : null;

                if (sessionId != null) {
                    logger.info("Session ID extrait du JSON brut: {}", sessionId);
                    session = Session.retrieve(sessionId);
                    logger.info("Session recuperee via API Stripe: {}", sessionId);
                } else {
                    logger.error("Impossible d'extraire le session ID du JSON brut");
                    return;
                }
            } catch (Exception e) {
                logger.error("Impossible de recuperer la session Stripe depuis le JSON brut: {}", e.getMessage());
                return;
            }
        }

        String sessionId = session.getId();
        String paymentStatus = session.getPaymentStatus();
        String mode = session.getMode();

        logger.info("checkout.session.completed: sessionId={}, paymentStatus={}, mode={}, metadata={}",
                sessionId, paymentStatus, mode, session.getMetadata());

        // Pour les subscriptions, le paymentStatus est "paid" quand le premier paiement reussit
        // Pour les paiements uniques, le paymentStatus est "paid"
        // On accepte "paid" et "no_payment_required" (essai gratuit, coupon 100%, etc.)
        if (!"paid".equals(paymentStatus) && !"no_payment_required".equals(paymentStatus)) {
            logger.warn("Paiement non confirme pour session {}: paymentStatus={}", sessionId, paymentStatus);
            return;
        }

        // Determiner le type depuis les metadata
        String type = null;
        if (session.getMetadata() != null && !session.getMetadata().isEmpty()) {
            type = session.getMetadata().get("type");
        }

        logger.info("Type determine pour session {}: type={}", sessionId, type);

        if ("inscription".equals(type)) {
            // Paiement d'inscription (subscription) : creer le compte utilisateur
            String customerId = session.getCustomer();
            String subscriptionId = session.getSubscription();
            logger.info("Subscription d'inscription reussie pour session: {}, customer: {}, subscription: {}", sessionId, customerId, subscriptionId);
            try {
                inscriptionService.completeInscription(sessionId, customerId, subscriptionId);
            } catch (Exception e) {
                logger.error("Erreur lors de la finalisation de l'inscription pour session: {}", sessionId, e);
            }
        } else {
            // Paiement d'intervention — paiement unique (flux existant)
            logger.info("Paiement d'intervention reussi pour session: {}", sessionId);
            stripeService.confirmPayment(sessionId);
        }
    }

    /**
     * Gere les paiements asynchrones reussis (pour les moyens de paiement differes)
     */
    private void handleAsyncPaymentSucceeded(Event event) {
        Session session = (Session) event.getDataObjectDeserializer()
                .getObject()
                .orElse(null);

        if (session == null) return;

        String sessionId = session.getId();
        String type = session.getMetadata() != null ? session.getMetadata().get("type") : null;

        if ("inscription".equals(type)) {
            String customerId = session.getCustomer();
            String subscriptionId = session.getSubscription();
            try {
                inscriptionService.completeInscription(sessionId, customerId, subscriptionId);
            } catch (Exception e) {
                logger.error("Erreur lors de la finalisation asynchrone de l'inscription: {}", sessionId, e);
            }
        } else {
            stripeService.confirmPayment(sessionId);
        }
    }

    /**
     * Gere les paiements asynchrones echoues
     */
    private void handleAsyncPaymentFailed(Event event) {
        Session session = (Session) event.getDataObjectDeserializer()
                .getObject()
                .orElse(null);

        if (session == null) return;

        String sessionId = session.getId();
        String type = session.getMetadata() != null ? session.getMetadata().get("type") : null;

        if ("inscription".equals(type)) {
            inscriptionService.markInscriptionFailed(sessionId);
        } else {
            stripeService.markPaymentAsFailed(sessionId);
        }
    }
}
