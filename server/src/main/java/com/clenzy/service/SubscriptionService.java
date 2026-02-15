package com.clenzy.service;

import com.clenzy.dto.InscriptionDto;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.param.SubscriptionCancelParams;
import com.stripe.param.checkout.SessionCreateParams;
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

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    @Value("${stripe.currency}")
    private String currency;

    @Value("${FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    public SubscriptionService(UserRepository userRepository, AuditLogService auditLogService) {
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
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

        // Prix PMS mensuel en centimes
        int priceInCents = InscriptionDto.PMS_SUBSCRIPTION_PRICE_CENTS;

        // Annuler l'ancien abonnement Stripe si existant
        if (user.getStripeSubscriptionId() != null && !user.getStripeSubscriptionId().isEmpty()) {
            try {
                Stripe.apiKey = stripeSecretKey;
                Subscription existingSub = Subscription.retrieve(user.getStripeSubscriptionId());
                if (!"canceled".equals(existingSub.getStatus())) {
                    existingSub.cancel(SubscriptionCancelParams.builder()
                            .setProrate(true)
                            .build());
                    log.info("Ancien abonnement Stripe {} annule pour user {}", user.getStripeSubscriptionId(), user.getEmail());
                }
            } catch (StripeException e) {
                log.warn("Erreur annulation ancien abonnement Stripe {}: {}", user.getStripeSubscriptionId(), e.getMessage());
                // On continue meme si l'annulation echoue
            }
        }

        // Creer une nouvelle session Stripe Checkout
        Stripe.apiKey = stripeSecretKey;

        String forfaitDisplayName = target.substring(0, 1).toUpperCase() + target.substring(1);

        SessionCreateParams.Builder paramsBuilder = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setSuccessUrl(frontendUrl + "/dashboard?upgrade=success")
                .setCancelUrl(frontendUrl + "/dashboard?upgrade=cancelled")
                .addLineItem(
                        SessionCreateParams.LineItem.builder()
                                .setQuantity(1L)
                                .setPriceData(
                                        SessionCreateParams.LineItem.PriceData.builder()
                                                .setCurrency(currency.toLowerCase())
                                                .setUnitAmount((long) priceInCents)
                                                .setRecurring(
                                                        SessionCreateParams.LineItem.PriceData.Recurring.builder()
                                                                .setInterval(SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH)
                                                                .build()
                                                )
                                                .setProductData(
                                                        SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                .setName("Clenzy - Upgrade " + forfaitDisplayName)
                                                                .setDescription("Mise a niveau vers le forfait " + forfaitDisplayName
                                                                        + " - Acces au planning, import iCal et interventions automatiques")
                                                                .build()
                                                )
                                                .build()
                                )
                                .build()
                )
                // Metadata pour identifier dans le webhook
                .putMetadata("type", "upgrade")
                .putMetadata("userId", user.getId().toString())
                .putMetadata("forfait", target)
                .putMetadata("previousForfait", currentForfait)
                .setSubscriptionData(
                        SessionCreateParams.SubscriptionData.builder()
                                .putMetadata("type", "upgrade")
                                .putMetadata("userId", user.getId().toString())
                                .putMetadata("forfait", target)
                                .build()
                );

        // Utiliser le customer Stripe existant si disponible
        if (user.getStripeCustomerId() != null && !user.getStripeCustomerId().isEmpty()) {
            paramsBuilder.setCustomer(user.getStripeCustomerId());
        } else {
            paramsBuilder.setCustomerEmail(user.getEmail());
        }

        Session session = Session.create(paramsBuilder.build());

        log.info("Session Stripe Checkout upgrade creee: {} pour user {}", session.getId(), user.getEmail());

        return Map.of("checkoutUrl", session.getUrl());
    }

    /**
     * Finalise l'upgrade apres confirmation du paiement via webhook Stripe.
     */
    public void completeUpgrade(String sessionId) {
        try {
            Stripe.apiKey = stripeSecretKey;
            Session session = Session.retrieve(sessionId);

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
