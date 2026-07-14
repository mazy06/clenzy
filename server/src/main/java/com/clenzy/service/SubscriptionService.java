package com.clenzy.service;

import com.clenzy.dto.InscriptionDto;
import com.clenzy.model.User;
import com.clenzy.payment.PaymentResult;
import com.clenzy.payment.StripeGateway;
import com.clenzy.payment.subscription.SubscriptionCheckoutRequest;
import com.clenzy.payment.subscription.SubscriptionInterval;
import com.clenzy.payment.subscription.SubscriptionProviderRegistry;
import com.clenzy.repository.UserRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.param.SubscriptionCancelParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;

/**
 * Service de gestion des abonnements (upgrade de forfait).
 * Utilise Stripe Checkout pour gerer les changements de forfait.
 */
@Service
@Transactional
public class SubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);

    private static final Set<String> VALID_FORFAITS = Set.of("essentiel", "confort", "premium");
    private static final Map<String, Integer> FORFAIT_ORDER = Map.of(
            "essentiel", 0, "confort", 1, "premium", 2
    );

    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final PricingConfigService pricingConfigService;
    private final StripeGateway stripeGateway;
    private final SubscriptionProviderRegistry subscriptionProviderRegistry;

    @Value("${stripe.currency}")
    private String currency;

    @Value("${FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    public SubscriptionService(UserRepository userRepository, AuditLogService auditLogService,
                               PricingConfigService pricingConfigService, StripeGateway stripeGateway,
                               SubscriptionProviderRegistry subscriptionProviderRegistry) {
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.pricingConfigService = pricingConfigService;
        this.stripeGateway = stripeGateway;
        this.subscriptionProviderRegistry = subscriptionProviderRegistry;
    }

    /**
     * Cree une session Stripe Checkout pour upgrader le forfait d'un utilisateur.
     *
     * @param keycloakId   ID Keycloak de l'utilisateur
     * @param targetForfait Forfait cible (confort, premium)
     * @return Map contenant l'URL de checkout Stripe
     */
    public Map<String, String> createUpgradeCheckout(String keycloakId, String targetForfait) throws StripeException {
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        String currentForfait = user.getForfait() != null ? user.getForfait().toLowerCase() : "essentiel";
        String target = targetForfait.toLowerCase();

        // Validations
        if (!VALID_FORFAITS.contains(target)) {
            throw new IllegalArgumentException("Forfait invalide : " + targetForfait);
        }

        int currentOrder = FORFAIT_ORDER.getOrDefault(currentForfait, 0);
        int targetOrder = FORFAIT_ORDER.getOrDefault(target, 0);

        if (targetOrder <= currentOrder) {
            throw new IllegalArgumentException("Vous ne pouvez upgrader que vers un forfait superieur. "
                    + "Forfait actuel: " + currentForfait + ", demande: " + target);
        }

        log.info("Upgrade forfait demande pour user {} : {} -> {}", user.getEmail(), currentForfait, target);

        // Prix PMS mensuel + supplément IA du forfait cible (campagne X5) —
        // source unique : PricingConfig
        int priceInCents = pricingConfigService.getPmsMonthlyPriceCents()
                + pricingConfigService.getAiMonthlySurchargeCents(target);

        // Annuler l'ancien abonnement Stripe si existant
        if (user.getStripeSubscriptionId() != null && !user.getStripeSubscriptionId().isEmpty()) {
            try {
                Subscription existingSub = stripeGateway.retrieveSubscription(user.getStripeSubscriptionId());
                if (!"canceled".equals(existingSub.getStatus())) {
                    stripeGateway.cancelSubscription(existingSub, SubscriptionCancelParams.builder()
                            .setProrate(true)
                            .build());
                    log.info("Ancien abonnement Stripe {} annule pour user {}", user.getStripeSubscriptionId(), user.getEmail());
                }
            } catch (StripeException e) {
                log.warn("Erreur annulation ancien abonnement Stripe {}: {}", user.getStripeSubscriptionId(), e.getMessage());
                // On continue meme si l'annulation echoue
            }
        }

        // Checkout d'abonnement HÉBERGÉ via le port SubscriptionProvider (Vague 3).
        String forfaitDisplayName = target.substring(0, 1).toUpperCase() + target.substring(1);
        boolean hasCustomer = user.getStripeCustomerId() != null && !user.getStripeCustomerId().isEmpty();

        Map<String, String> metadata = new java.util.HashMap<>();
        metadata.put("type", "upgrade");
        metadata.put("userId", user.getId().toString());
        metadata.put("forfait", target);
        metadata.put("previousForfait", currentForfait);

        SubscriptionCheckoutRequest request = new SubscriptionCheckoutRequest(
                priceInCents,
                currency,
                SubscriptionInterval.MONTH,
                1L,
                "Baitly - Upgrade " + forfaitDisplayName,
                "Mise a niveau vers le forfait " + forfaitDisplayName
                        + " - Acces au planning, import iCal et interventions automatiques",
                hasCustomer ? null : user.getEmail(),
                hasCustomer ? user.getStripeCustomerId() : null,
                false,                                              // hébergé
                frontendUrl + "/dashboard?upgrade=success",
                frontendUrl + "/dashboard?upgrade=cancelled",
                null,                                               // pas de coupon
                metadata);

        PaymentResult result = subscriptionProviderRegistry.resolve(currency).createSubscriptionCheckout(request);
        if (!result.success()) {
            throw new RuntimeException("Echec de creation de la session d'abonnement: " + result.errorMessage());
        }
        log.info("Session d'abonnement upgrade creee: {} pour user {}", result.providerTxId(), user.getEmail());
        return Map.of("checkoutUrl", result.redirectUrl());
    }

    /**
     * Finalise l'upgrade apres confirmation du paiement via webhook Stripe.
     */
    public void completeUpgrade(String sessionId) {
        try {
            Session session = stripeGateway.retrieveSession(sessionId);

            String type = session.getMetadata().get("type");
            if (!"upgrade".equals(type)) {
                log.warn("Session {} n'est pas de type upgrade (type={})", sessionId, type);
                return;
            }

            String userIdStr = session.getMetadata().get("userId");
            String targetForfait = session.getMetadata().get("forfait");
            String previousForfait = session.getMetadata().get("previousForfait");

            if (userIdStr == null || targetForfait == null) {
                log.error("Metadata incompletes pour la session upgrade {}", sessionId);
                return;
            }

            Long userId = Long.parseLong(userIdStr);
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Utilisateur id=" + userId + " introuvable"));

            // Mettre a jour le forfait
            user.setForfait(targetForfait);

            // Mettre a jour le stripeSubscriptionId et stripeCustomerId
            String subscriptionId = session.getSubscription();
            if (subscriptionId != null) {
                user.setStripeSubscriptionId(subscriptionId);
            }
            String customerId = session.getCustomer();
            if (customerId != null) {
                user.setStripeCustomerId(customerId);
            }

            userRepository.save(user);

            // Audit log
            auditLogService.logSync("SubscriptionUpgrade", userId.toString(),
                    "Upgrade forfait: " + previousForfait + " -> " + targetForfait
                            + " pour " + user.getEmail() + " (session " + sessionId + ")");

            log.info("Upgrade forfait termine: {} -> {} pour user {} ({})",
                    previousForfait, targetForfait, user.getEmail(), userId);

        } catch (StripeException e) {
            log.error("Erreur Stripe lors de la completion de l'upgrade (session {}): {}", sessionId, e.getMessage());
            throw new RuntimeException("Erreur Stripe: " + e.getMessage());
        }
    }
}
