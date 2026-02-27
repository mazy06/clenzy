package com.clenzy.service;

import com.clenzy.dto.InscriptionDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.*;
import com.stripe.model.Invoice;
import com.stripe.param.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

/**
 * Service de paiement natif mobile via Stripe Payment Sheet.
 * Gere la creation de PaymentIntent (interventions) et Subscription (upgrades de forfait)
 * pour le SDK Stripe React Native (Apple Pay, Google Pay, carte bancaire).
 */
@Service
@Transactional
public class MobilePaymentService {

    private static final Logger log = LoggerFactory.getLogger(MobilePaymentService.class);

    private static final Set<String> VALID_FORFAITS = Set.of("essentiel", "confort", "premium");
    private static final Map<String, Integer> FORFAIT_ORDER = Map.of(
            "essentiel", 0, "confort", 1, "premium", 2
    );

    private final UserRepository userRepository;
    private final InterventionRepository interventionRepository;
    private final AuditLogService auditLogService;
    private final PricingConfigService pricingConfigService;

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    @Value("${stripe.publishable-key}")
    private String publishableKey;

    @Value("${stripe.currency}")
    private String currency;

    public MobilePaymentService(UserRepository userRepository,
                                InterventionRepository interventionRepository,
                                AuditLogService auditLogService,
                                PricingConfigService pricingConfigService) {
        this.userRepository = userRepository;
        this.interventionRepository = interventionRepository;
        this.auditLogService = auditLogService;
        this.pricingConfigService = pricingConfigService;
    }

    /**
     * Cree les elements necessaires pour initialiser le Payment Sheet sur mobile.
     *
     * @param keycloakId      ID Keycloak de l'utilisateur authentifie
     * @param type            "subscription" ou "intervention"
     * @param forfait         Forfait cible (pour type=subscription)
     * @param interventionId  ID de l'intervention (pour type=intervention)
     * @param amountCents     Montant en centimes (pour type=intervention)
     * @return Map avec paymentIntent (client secret), ephemeralKey, customer, publishableKey
     */
    public Map<String, String> createPaymentSheet(String keycloakId, String type,
                                                   String forfait, Long interventionId,
                                                   Long amountCents) throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        // Creer ou recuperer le Stripe Customer
        String customerId = getOrCreateCustomer(user);

        // Creer l'EphemeralKey pour le Payment Sheet
        String ephemeralKeySecret = createEphemeralKey(customerId);

        // Creer le PaymentIntent ou la Subscription selon le type
        String clientSecret;

        if ("subscription".equals(type)) {
            clientSecret = createSubscriptionSheet(user, customerId, forfait);
        } else if ("intervention".equals(type)) {
            clientSecret = createInterventionSheet(customerId, interventionId, amountCents, user);
        } else {
            throw new IllegalArgumentException("Type de paiement invalide: " + type);
        }

        return Map.of(
                "paymentIntent", clientSecret,
                "ephemeralKey", ephemeralKeySecret,
                "customer", customerId,
                "publishableKey", publishableKey
        );
    }

    /**
     * Finalise l'upgrade de forfait apres reception du webhook payment_intent.succeeded.
     */
    public void completeSubscriptionUpgrade(PaymentIntent paymentIntent) {
        Map<String, String> metadata = paymentIntent.getMetadata();
        if (metadata == null) return;

        String userIdStr = metadata.get("userId");
        String targetForfait = metadata.get("forfait");
        String previousForfait = metadata.get("previousForfait");
        String subscriptionId = metadata.get("subscriptionId");

        if (userIdStr == null || targetForfait == null) {
            log.error("Metadata incompletes sur le PaymentIntent {}", paymentIntent.getId());
            return;
        }

        Long userId = Long.parseLong(userIdStr);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur id=" + userId + " introuvable"));

        // Mettre a jour le forfait
        user.setForfait(targetForfait);

        // Mettre a jour les IDs Stripe
        if (subscriptionId != null) {
            user.setStripeSubscriptionId(subscriptionId);
        }
        String customerId = paymentIntent.getCustomer();
        if (customerId != null) {
            user.setStripeCustomerId(customerId);
        }

        userRepository.save(user);

        auditLogService.logSync("MobileSubscriptionUpgrade", userId.toString(),
                "Upgrade forfait mobile: " + previousForfait + " -> " + targetForfait
                        + " pour " + user.getEmail() + " (PaymentIntent " + paymentIntent.getId() + ")");

        log.info("Upgrade forfait mobile termine: {} -> {} pour user {} ({})",
                previousForfait, targetForfait, user.getEmail(), userId);
    }

    /**
     * Confirme le paiement d'une intervention via Payment Sheet (webhook payment_intent.succeeded).
     */
    public void completeInterventionPayment(PaymentIntent paymentIntent) {
        Map<String, String> metadata = paymentIntent.getMetadata();
        if (metadata == null) return;

        String interventionIdStr = metadata.get("interventionId");
        if (interventionIdStr == null) {
            log.error("interventionId manquant dans les metadata du PaymentIntent {}", paymentIntent.getId());
            return;
        }

        Long interventionId = Long.parseLong(interventionIdStr);
        Intervention intervention = interventionRepository.findById(interventionId)
                .orElse(null);

        if (intervention == null) {
            log.error("Intervention {} introuvable pour PaymentIntent {}", interventionId, paymentIntent.getId());
            return;
        }

        intervention.setPaymentStatus(PaymentStatus.PAID);
        intervention.setPaidAt(java.time.LocalDateTime.now());
        intervention.setStripeSessionId(paymentIntent.getId()); // Stocker le PI ID pour reference

        if (intervention.getStatus() == com.clenzy.model.InterventionStatus.AWAITING_PAYMENT) {
            intervention.setStatus(com.clenzy.model.InterventionStatus.PENDING);
        }

        interventionRepository.save(intervention);

        log.info("Paiement intervention {} confirme via Payment Sheet mobile (PaymentIntent {})",
                interventionId, paymentIntent.getId());
    }

    // ─── Methodes privees ────────────────────────────────────────────────────────

    private String getOrCreateCustomer(User user) throws StripeException {
        if (user.getStripeCustomerId() != null && !user.getStripeCustomerId().isEmpty()) {
            // Verifier que le customer existe toujours chez Stripe
            try {
                Customer existing = Customer.retrieve(user.getStripeCustomerId());
                if (existing.getDeleted() == null || !existing.getDeleted()) {
                    return user.getStripeCustomerId();
                }
            } catch (StripeException e) {
                log.warn("Customer Stripe {} introuvable, creation d'un nouveau: {}",
                        user.getStripeCustomerId(), e.getMessage());
            }
        }

        // Creer un nouveau Customer Stripe
        CustomerCreateParams params = CustomerCreateParams.builder()
                .setEmail(user.getEmail())
                .setName(user.getFullName())
                .putMetadata("userId", user.getId().toString())
                .putMetadata("keycloakId", user.getKeycloakId() != null ? user.getKeycloakId() : "")
                .build();

        Customer customer = Customer.create(params);

        user.setStripeCustomerId(customer.getId());
        userRepository.save(user);

        log.info("Nouveau Customer Stripe cree: {} pour user {}", customer.getId(), user.getEmail());
        return customer.getId();
    }

    private String createEphemeralKey(String customerId) throws StripeException {
        EphemeralKeyCreateParams params = EphemeralKeyCreateParams.builder()
                .setCustomer(customerId)
                .build();

        EphemeralKey ephemeralKey = EphemeralKey.create(params);
        return ephemeralKey.getSecret();
    }

    /**
     * Cree une Subscription avec payment_behavior=default_incomplete pour le Payment Sheet.
     * Le PaymentIntent genere automatiquement par la facture est utilise comme client secret.
     */
    private String createSubscriptionSheet(User user, String customerId, String targetForfait)
            throws StripeException {

        String target = targetForfait.toLowerCase();

        // Validation du forfait
        if (!VALID_FORFAITS.contains(target)) {
            throw new IllegalArgumentException("Forfait invalide: " + targetForfait);
        }

        String currentForfait = user.getForfait() != null ? user.getForfait().toLowerCase() : "essentiel";
        int currentOrder = FORFAIT_ORDER.getOrDefault(currentForfait, 0);
        int targetOrder = FORFAIT_ORDER.getOrDefault(target, 0);

        if (targetOrder <= currentOrder) {
            throw new IllegalArgumentException(
                    "Vous ne pouvez upgrader que vers un forfait superieur. "
                            + "Forfait actuel: " + currentForfait + ", demande: " + target);
        }

        log.info("Creation Payment Sheet upgrade pour user {} : {} -> {}",
                user.getEmail(), currentForfait, target);

        // Annuler l'ancien abonnement Stripe si existant
        cancelExistingSubscription(user);

        // Prix PMS mensuel en centimes (source unique : PricingConfig)
        long priceInCents = pricingConfigService.getPmsMonthlyPriceCents();
        String forfaitDisplayName = target.substring(0, 1).toUpperCase() + target.substring(1);

        // Creer un Price inline (avec Product inline)
        PriceCreateParams priceParams = PriceCreateParams.builder()
                .setCurrency(currency.toLowerCase())
                .setUnitAmount(priceInCents)
                .setRecurring(PriceCreateParams.Recurring.builder()
                        .setInterval(PriceCreateParams.Recurring.Interval.MONTH)
                        .build())
                .setProductData(PriceCreateParams.ProductData.builder()
                        .setName("Clenzy - Forfait " + forfaitDisplayName)
                        .build())
                .build();

        Price price = Price.create(priceParams);

        // Creer la Subscription avec default_incomplete
        SubscriptionCreateParams subParams = SubscriptionCreateParams.builder()
                .setCustomer(customerId)
                .addItem(SubscriptionCreateParams.Item.builder()
                        .setPrice(price.getId())
                        .build())
                .setPaymentBehavior(SubscriptionCreateParams.PaymentBehavior.DEFAULT_INCOMPLETE)
                .setPaymentSettings(SubscriptionCreateParams.PaymentSettings.builder()
                        .setSaveDefaultPaymentMethod(
                                SubscriptionCreateParams.PaymentSettings.SaveDefaultPaymentMethod.ON_SUBSCRIPTION)
                        .build())
                .addExpand("latest_invoice.payment_intent")
                .putMetadata("type", "mobile_upgrade")
                .putMetadata("userId", user.getId().toString())
                .putMetadata("forfait", target)
                .putMetadata("previousForfait", currentForfait)
                .build();

        Subscription subscription = Subscription.create(subParams);

        // Extraire le PaymentIntent de la derniere facture
        Invoice invoice = subscription.getLatestInvoiceObject();
        PaymentIntent paymentIntent = invoice.getPaymentIntentObject();

        // Ajouter les metadata au PaymentIntent pour le routing webhook
        PaymentIntentUpdateParams piUpdateParams = PaymentIntentUpdateParams.builder()
                .putMetadata("type", "mobile_upgrade")
                .putMetadata("userId", user.getId().toString())
                .putMetadata("forfait", target)
                .putMetadata("previousForfait", currentForfait)
                .putMetadata("subscriptionId", subscription.getId())
                .build();

        paymentIntent = PaymentIntent.retrieve(paymentIntent.getId())
                .update(piUpdateParams);

        log.info("Subscription {} creee (default_incomplete) avec PaymentIntent {} pour user {}",
                subscription.getId(), paymentIntent.getId(), user.getEmail());

        return paymentIntent.getClientSecret();
    }

    /**
     * Cree un PaymentIntent pour le paiement d'une intervention via Payment Sheet.
     */
    private String createInterventionSheet(String customerId, Long interventionId,
                                            Long amountCents, User user) throws StripeException {
        if (interventionId == null) {
            throw new IllegalArgumentException("interventionId est requis pour le paiement d'intervention");
        }

        Intervention intervention = interventionRepository.findById(interventionId)
                .orElseThrow(() -> new RuntimeException("Intervention introuvable: " + interventionId));

        // Utiliser le montant fourni ou celui de l'intervention
        long amount = amountCents != null ? amountCents
                : intervention.getEstimatedCost() != null
                ? intervention.getEstimatedCost().multiply(BigDecimal.valueOf(100)).longValue()
                : 0;

        if (amount <= 0) {
            throw new IllegalArgumentException("Montant invalide pour l'intervention");
        }

        PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(amount)
                .setCurrency(currency.toLowerCase())
                .setCustomer(customerId)
                .setAutomaticPaymentMethods(
                        PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                                .setEnabled(true)
                                .build())
                .putMetadata("type", "mobile_intervention")
                .putMetadata("interventionId", interventionId.toString())
                .putMetadata("userId", user.getId().toString())
                .build();

        PaymentIntent paymentIntent = PaymentIntent.create(params);

        // Mettre a jour le statut de l'intervention
        intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        intervention.setStripeSessionId(paymentIntent.getId());
        interventionRepository.save(intervention);

        log.info("PaymentIntent {} cree pour intervention {} (montant: {} cents) pour user {}",
                paymentIntent.getId(), interventionId, amount, user.getEmail());

        return paymentIntent.getClientSecret();
    }

    private void cancelExistingSubscription(User user) {
        if (user.getStripeSubscriptionId() == null || user.getStripeSubscriptionId().isEmpty()) {
            return;
        }

        try {
            Subscription existingSub = Subscription.retrieve(user.getStripeSubscriptionId());
            if (!"canceled".equals(existingSub.getStatus())) {
                existingSub.cancel(SubscriptionCancelParams.builder()
                        .setProrate(true)
                        .build());
                log.info("Ancien abonnement Stripe {} annule pour user {}",
                        user.getStripeSubscriptionId(), user.getEmail());
            }
        } catch (StripeException e) {
            log.warn("Erreur annulation ancien abonnement Stripe {}: {}",
                    user.getStripeSubscriptionId(), e.getMessage());
        }
    }
}
