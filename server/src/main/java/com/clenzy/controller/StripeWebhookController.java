package com.clenzy.controller;

import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.integration.direct.service.DirectBookingService;
import com.clenzy.payment.StripeGateway;
import com.clenzy.service.InscriptionService;
import com.clenzy.service.MobilePaymentService;
import com.clenzy.service.PaymentOrchestrationService;
import com.clenzy.service.ShopService;
import com.clenzy.service.StripeConnectService;
import com.clenzy.service.StripeService;
import com.clenzy.service.SubscriptionService;
import com.clenzy.service.UpsellService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.PaymentIntent;
import com.stripe.model.StripeObject;
import com.stripe.model.Transfer;
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
    private final PaymentOrchestrationService orchestrationService;
    private final StripeConnectService stripeConnectService;
    private final ShopService shopService;
    private final PublicBookingService publicBookingService;
    private final UpsellService upsellService;
    private final StripeGateway stripeGateway;
    private final DirectBookingService directBookingService;

    @Value("${stripe.webhook-secret}")
    private String webhookSecret;

    public StripeWebhookController(StripeService stripeService,
                                   InscriptionService inscriptionService,
                                   SubscriptionService subscriptionService,
                                   MobilePaymentService mobilePaymentService,
                                   PaymentOrchestrationService orchestrationService,
                                   StripeConnectService stripeConnectService,
                                   ShopService shopService,
                                   PublicBookingService publicBookingService,
                                   UpsellService upsellService,
                                   StripeGateway stripeGateway,
                                   DirectBookingService directBookingService) {
        this.stripeService = stripeService;
        this.inscriptionService = inscriptionService;
        this.subscriptionService = subscriptionService;
        this.mobilePaymentService = mobilePaymentService;
        this.orchestrationService = orchestrationService;
        this.stripeConnectService = stripeConnectService;
        this.shopService = shopService;
        this.publicBookingService = publicBookingService;
        this.upsellService = upsellService;
        this.stripeGateway = stripeGateway;
        this.directBookingService = directBookingService;
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

        // Traiter l'evenement. Un echec de traitement retourne 500 pour que Stripe
        // re-livre l'evenement (Z3-BUGS-10) : les handlers de confirmation sont
        // idempotents (PaymentStatusTransitionService, gardes de statut), une
        // re-livraison ne produit donc pas de double effet.
        try {
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

                case "account.updated":
                    handleAccountUpdated(event);
                    break;

                case "transfer.failed":
                    handleTransferFailed(event);
                    break;

                default:
                    logger.debug("Evenement Stripe non gere: {}", event.getType());
                    break;
            }
        } catch (Exception e) {
            logger.error("Echec du traitement du webhook Stripe eventId={}, type={} -> retour 500 pour re-livraison",
                    event.getId(), event.getType(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Erreur lors du traitement de l'evenement");
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

                if (sessionId == null) {
                    // Payload sans id : une re-livraison du meme payload echouera pareil,
                    // on acquitte (200) pour ne pas boucler inutilement.
                    logger.error("Impossible d'extraire le session ID du JSON brut");
                    return;
                }
                logger.info("Session ID extrait du JSON brut: {}", sessionId);
                session = stripeGateway.retrieveSession(sessionId);
                logger.info("Session recuperee via API Stripe: {}", sessionId);
            } catch (Exception e) {
                // Echec potentiellement transitoire (API Stripe) : propager pour
                // retourner 500 et declencher la re-livraison Stripe.
                throw new IllegalStateException(
                        "Impossible de recuperer la session Stripe depuis le JSON brut", e);
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

        // Z3-BUGS-10 : plus de try/catch avaleur par branche. Une exception de
        // confirmation remonte au handler principal qui retourne 500 → Stripe
        // re-livre l'evenement (les confirmations sont idempotentes).
        if ("hardware_purchase".equals(type)) {
            // Paiement d'achat de materiel IoT (shop)
            logger.info("Paiement hardware reussi pour session: {}", sessionId);
            shopService.completeOrder(sessionId);
            updatePaymentTransaction(session, true);
            return;
        } else if ("inscription".equals(type)) {
            // Paiement d'inscription (subscription) : confirmer le paiement + envoyer email de confirmation
            String customerId = session.getCustomer();
            String subscriptionId = session.getSubscription();
            logger.info("Subscription d'inscription reussie pour session: {}, customer: {}, subscription: {}", sessionId, customerId, subscriptionId);
            inscriptionService.confirmPayment(sessionId, customerId, subscriptionId);
        } else if ("upgrade".equals(type)) {
            // Upgrade de forfait (subscription) : mettre a jour le forfait utilisateur
            logger.info("Upgrade de forfait reussi pour session: {}", sessionId);
            subscriptionService.completeUpgrade(sessionId);
        } else if ("grouped_deferred".equals(type)) {
            // Paiement groupe differe : confirmer toutes les interventions incluses
            String interventionIds = session.getMetadata().get("intervention_ids");
            logger.info("Paiement groupe differe reussi pour session: {}, interventions: {}", sessionId, interventionIds);
            stripeService.confirmGroupedPayment(sessionId, interventionIds);
        } else if ("reservation".equals(type)) {
            // Paiement de reservation (envoye par email au guest)
            logger.info("Paiement de reservation reussi pour session: {}", sessionId);
            stripeService.confirmReservationPayment(sessionId);
        } else if ("booking_engine".equals(type)) {
            // Paiement d'une reservation creee via le Booking Engine public (widget SDK).
            // Le webhook gere deux scenarios :
            //  - reservation deja creee (flux SDK avec /reserve avant /checkout) → la passer en PAID
            //  - reservation absente (flux Embedded Checkout direct) → la creer ex-nihilo depuis metadata
            logger.info("Paiement Booking Engine reussi pour session: {}", sessionId);
            publicBookingService.confirmBookingEngineCheckout(session);
        } else if ("service_request".equals(type)) {
            // Paiement de demande de service → confirmation + creation intervention automatique
            String srId = session.getMetadata().get("service_request_id");
            logger.info("Paiement SR reussi pour session: {}, srId: {}", sessionId, srId);
            stripeService.confirmServiceRequestPayment(sessionId);
        } else if ("upsell".equals(type)) {
            // Paiement d'un upsell du livret (early check-in, ménage, transfert…)
            logger.info("Paiement upsell reussi pour session: {}", sessionId);
            upsellService.markPaidBySession(sessionId);
        } else {
            // Paiement d'intervention — paiement unique (flux existant)
            logger.info("Paiement d'intervention reussi pour session: {}", sessionId);
            stripeService.confirmPayment(sessionId);
        }

        // Update PaymentTransaction if the payment was routed through the orchestrator
        updatePaymentTransaction(session, true);
    }

    /**
     * Updates the PaymentTransaction record via the orchestrator.
     * If the session metadata contains a transactionRef, we update the corresponding
     * PaymentTransaction to keep it in sync with Stripe's status.
     */
    private void updatePaymentTransaction(Session session, boolean success) {
        if (session == null || session.getMetadata() == null) return;
        String transactionRef = session.getMetadata().get("transactionRef");
        if (transactionRef == null || transactionRef.isBlank()) return;

        // Z3-BUGS-10 : un echec ici remonte au handler principal (500 → re-livraison).
        // completeTransaction est idempotent (skip si deja COMPLETED).
        if (success) {
            orchestrationService.completeTransaction(transactionRef);
            logger.info("PaymentTransaction {} marked COMPLETED via Stripe webhook", transactionRef);
        } else {
            orchestrationService.failTransaction(transactionRef, "Stripe async payment failed");
            logger.info("PaymentTransaction {} marked FAILED via Stripe webhook", transactionRef);
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

        if ("hardware_purchase".equals(type)) {
            logger.info("Paiement hardware asynchrone reussi pour session: {}", sessionId);
            shopService.completeOrder(sessionId);
        } else if ("inscription".equals(type)) {
            String customerId = session.getCustomer();
            String subscriptionId = session.getSubscription();
            inscriptionService.confirmPayment(sessionId, customerId, subscriptionId);
        } else if ("grouped_deferred".equals(type)) {
            String interventionIds = session.getMetadata() != null ? session.getMetadata().get("intervention_ids") : null;
            logger.info("Paiement groupe differe asynchrone reussi pour session: {}", sessionId);
            stripeService.confirmGroupedPayment(sessionId, interventionIds);
        } else if ("reservation".equals(type)) {
            logger.info("Paiement de reservation asynchrone reussi pour session: {}", sessionId);
            stripeService.confirmReservationPayment(sessionId);
        } else if ("booking_engine".equals(type)) {
            logger.info("Paiement Booking Engine asynchrone reussi pour session: {}", sessionId);
            publicBookingService.confirmBookingEngineCheckout(session);
        } else if ("service_request".equals(type)) {
            logger.info("Paiement SR asynchrone reussi pour session: {}", sessionId);
            stripeService.confirmServiceRequestPayment(sessionId);
        } else {
            stripeService.confirmPayment(sessionId);
        }

        // Update PaymentTransaction for async success
        updatePaymentTransaction(session, true);
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
        } else if ("reservation".equals(type)) {
            logger.warn("Paiement de reservation echoue pour session: {}", sessionId);
            stripeService.markReservationPaymentFailed(sessionId);
        } else if ("service_request".equals(type)) {
            logger.warn("Paiement SR echoue pour session: {}", sessionId);
            stripeService.markServiceRequestPaymentFailed(sessionId);
        } else {
            stripeService.markPaymentAsFailed(sessionId);
        }

        // Update PaymentTransaction for async failure
        updatePaymentTransaction(session, false);
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
            mobilePaymentService.completeSubscriptionUpgrade(paymentIntent);
        } else if ("mobile_intervention".equals(type)) {
            // Paiement d'intervention via Payment Sheet mobile
            mobilePaymentService.completeInterventionPayment(paymentIntent);
        } else if ("direct_booking".equals(type)) {
            // I1-OTA-01 : SEULE voie de confirmation d'une reservation directe payante.
            // Le webhook a deja verifie la signature Stripe → on confirme la resa.
            confirmDirectBooking(paymentIntent);
        } else {
            // PaymentIntent non gere par le mobile (peut etre un PI d'un Checkout Session web)
            logger.debug("payment_intent.succeeded ignore (type={})", type);
        }
    }

    /**
     * Confirme une reservation directe payante apres paiement Stripe reussi
     * (metadata type=direct_booking, cf. DirectBookingService.createBookingWithPayment).
     * La confirmation est idempotente cote service (re-livraison Stripe sans effet).
     */
    private void confirmDirectBooking(PaymentIntent paymentIntent) {
        java.util.Map<String, String> metadata = paymentIntent.getMetadata();
        String bookingId = metadata != null ? metadata.get("booking_id") : null;
        String orgIdStr = metadata != null ? metadata.get("org_id") : null;
        if (bookingId == null || orgIdStr == null) {
            // Metadata incompletes : deterministe, une re-livraison echouerait pareil — on acquitte.
            logger.error("payment_intent.succeeded direct_booking sans booking_id/org_id (PI {})",
                    paymentIntent.getId());
            return;
        }
        final Long orgId;
        try {
            orgId = Long.parseLong(orgIdStr);
        } catch (NumberFormatException e) {
            logger.error("org_id invalide '{}' sur PaymentIntent direct_booking {}",
                    orgIdStr, paymentIntent.getId());
            return;
        }
        directBookingService.confirmPaidBookingFromWebhook(bookingId, orgId);
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
                    Long.parseLong(interventionIdStr);
                } catch (NumberFormatException e) {
                    // Metadata corrompue : deterministe, une re-livraison echouerait pareil — on acquitte.
                    logger.error("interventionId invalide '{}' sur PaymentIntent {}",
                            interventionIdStr, paymentIntent.getId());
                    return;
                }
                // Reutiliser la logique existante via le session ID stocke.
                // Un echec remonte au handler principal (500 → re-livraison).
                stripeService.markPaymentAsFailed(paymentIntent.getId());
            }
        }
        // Pour mobile_upgrade, pas d'action speciale (la subscription reste incomplete)
    }

    /**
     * Handles Stripe Connect account.updated event.
     * Updates onboarding completion status when the connected account becomes fully active.
     */
    private void handleAccountUpdated(Event event) {
        Account account = (Account) event.getDataObjectDeserializer()
                .getObject()
                .orElse(null);

        if (account == null) {
            logger.warn("Account null dans account.updated");
            return;
        }

        boolean chargesEnabled = Boolean.TRUE.equals(account.getChargesEnabled());
        boolean payoutsEnabled = Boolean.TRUE.equals(account.getPayoutsEnabled());

        logger.info("account.updated: id={}, chargesEnabled={}, payoutsEnabled={}",
                account.getId(), chargesEnabled, payoutsEnabled);

        stripeConnectService.handleAccountUpdated(account.getId(), chargesEnabled, payoutsEnabled);
    }

    /**
     * Handles Stripe Connect transfer.failed event.
     * Logs the failure — payout failure is already handled during execution.
     */
    private void handleTransferFailed(Event event) {
        Transfer transfer = (Transfer) event.getDataObjectDeserializer()
                .getObject()
                .orElse(null);

        if (transfer == null) {
            logger.warn("Transfer null dans transfer.failed");
            return;
        }

        logger.error("Stripe transfer failed: id={}, destination={}, amount={}",
                transfer.getId(), transfer.getDestination(), transfer.getAmount());
    }
}
