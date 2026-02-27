package com.clenzy.controller;

import com.clenzy.service.InscriptionService;
import com.clenzy.service.MobilePaymentService;
import com.clenzy.service.StripeService;
import com.clenzy.service.SubscriptionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.PaymentIntent;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// Security: This controller handles Stripe webhook callbacks and MUST remain publicly accessible.
// Authentication is performed via Stripe's webhook signature verification, not Spring Security.
// See SecurityConfigProd.java permitAll() for the endpoint whitelist.
@RestController
@RequestMapping("/api/webhooks/stripe")
public class StripeWebhookController {

    private static final Logger logger = LoggerFactory.getLogger(StripeWebhookController.class);

    private final StripeService stripeService;
    private final InscriptionService inscriptionService;
    private final SubscriptionService subscriptionService;
    private final MobilePaymentService mobilePaymentService;

    @Value("${stripe.webhook-secret}")
    private String webhookSecret;

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    public StripeWebhookController(StripeService stripeService,
                                   InscriptionService inscriptionService,
                                   SubscriptionService subscriptionService,
                                   MobilePaymentService mobilePaymentService) {
        this.stripeService = stripeService;
        this.inscriptionService = inscriptionService;
        this.subscriptionService = subscriptionService;
        this.mobilePaymentService = mobilePaymentService;
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

            case "payment_intent.succeeded":
                handlePaymentIntentSucceeded(event);
                break;

            case "payment_intent.payment_failed":
                handlePaymentIntentFailed(event);
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
            // Paiement d'inscription (subscription) : confirmer le paiement + envoyer email de confirmation
            String customerId = session.getCustomer();
            String subscriptionId = session.getSubscription();
            logger.info("Subscription d'inscription reussie pour session: {}, customer: {}, subscription: {}", sessionId, customerId, subscriptionId);
            try {
                inscriptionService.confirmPayment(sessionId, customerId, subscriptionId);
            } catch (Exception e) {
                logger.error("Erreur lors de la confirmation du paiement d'inscription pour session: {}", sessionId, e);
            }
        } else if ("upgrade".equals(type)) {
            // Upgrade de forfait (subscription) : mettre a jour le forfait utilisateur
            logger.info("Upgrade de forfait reussi pour session: {}", sessionId);
            try {
                subscriptionService.completeUpgrade(sessionId);
            } catch (Exception e) {
                logger.error("Erreur lors de la finalisation de l'upgrade pour session: {}", sessionId, e);
            }
        } else if ("grouped_deferred".equals(type)) {
            // Paiement groupe differe : confirmer toutes les interventions incluses
            String interventionIds = session.getMetadata().get("intervention_ids");
            logger.info("Paiement groupe differe reussi pour session: {}, interventions: {}", sessionId, interventionIds);
            stripeService.confirmGroupedPayment(sessionId, interventionIds);
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
                inscriptionService.confirmPayment(sessionId, customerId, subscriptionId);
            } catch (Exception e) {
                logger.error("Erreur lors de la confirmation asynchrone du paiement d'inscription: {}", sessionId, e);
            }
        } else if ("grouped_deferred".equals(type)) {
            String interventionIds = session.getMetadata() != null ? session.getMetadata().get("intervention_ids") : null;
            logger.info("Paiement groupe differe asynchrone reussi pour session: {}", sessionId);
            stripeService.confirmGroupedPayment(sessionId, interventionIds);
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
        } else if ("grouped_deferred".equals(type)) {
            String interventionIds = session.getMetadata() != null ? session.getMetadata().get("intervention_ids") : null;
            logger.warn("Paiement groupe differe echoue pour session: {}", sessionId);
            stripeService.markGroupedPaymentAsFailed(interventionIds);
        } else {
            stripeService.markPaymentAsFailed(sessionId);
        }
    }

    /**
     * Gere payment_intent.succeeded pour les paiements via Payment Sheet mobile.
     * Route vers le bon service selon le type dans les metadata du PaymentIntent.
     */
    private void handlePaymentIntentSucceeded(Event event) {
        PaymentIntent paymentIntent = (PaymentIntent) event.getDataObjectDeserializer()
                .getObject()
                .orElse(null);

        if (paymentIntent == null) {
            logger.warn("PaymentIntent null dans payment_intent.succeeded");
            return;
        }

        String type = paymentIntent.getMetadata() != null
                ? paymentIntent.getMetadata().get("type") : null;

        logger.info("payment_intent.succeeded: id={}, type={}, metadata={}",
                paymentIntent.getId(), type, paymentIntent.getMetadata());

        if ("mobile_upgrade".equals(type)) {
            // Upgrade de forfait via Payment Sheet mobile
            try {
                mobilePaymentService.completeSubscriptionUpgrade(paymentIntent);
            } catch (Exception e) {
                logger.error("Erreur lors de l'upgrade mobile pour PaymentIntent {}: {}",
                        paymentIntent.getId(), e.getMessage(), e);
            }
        } else if ("mobile_intervention".equals(type)) {
            // Paiement d'intervention via Payment Sheet mobile
            try {
                mobilePaymentService.completeInterventionPayment(paymentIntent);
            } catch (Exception e) {
                logger.error("Erreur lors du paiement intervention mobile pour PaymentIntent {}: {}",
                        paymentIntent.getId(), e.getMessage(), e);
            }
        } else {
            // PaymentIntent non gere par le mobile (peut etre un PI d'un Checkout Session web)
            logger.debug("payment_intent.succeeded ignore (type={})", type);
        }
    }

    /**
     * Gere payment_intent.payment_failed pour les echecs de paiement via Payment Sheet mobile.
     */
    private void handlePaymentIntentFailed(Event event) {
        PaymentIntent paymentIntent = (PaymentIntent) event.getDataObjectDeserializer()
                .getObject()
                .orElse(null);

        if (paymentIntent == null) return;

        String type = paymentIntent.getMetadata() != null
                ? paymentIntent.getMetadata().get("type") : null;

        logger.warn("payment_intent.payment_failed: id={}, type={}",
                paymentIntent.getId(), type);

        if ("mobile_intervention".equals(type)) {
            String interventionIdStr = paymentIntent.getMetadata().get("interventionId");
            if (interventionIdStr != null) {
                try {
                    Long interventionId = Long.parseLong(interventionIdStr);
                    // Reutiliser la logique existante via le session ID stocke
                    stripeService.markPaymentAsFailed(paymentIntent.getId());
                } catch (Exception e) {
                    logger.error("Erreur gestion echec paiement mobile intervention: {}", e.getMessage());
                }
            }
        }
        // Pour mobile_upgrade, pas d'action speciale (la subscription reste incomplete)
    }
}
