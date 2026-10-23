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
import java.util.Locale;
import java.util.Objects;

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

        log.info("Upgrade forfait demande : {} -> {}", currentForfait, target);

        // Prix PMS mensuel + supplément IA du forfait cible (campagne X5) —
        // source unique : PricingConfig
        int priceInCents = pricingConfigService.getPmsMonthlyPriceCents()
                + pricingConfigService.getAiMonthlySurchargeCents(target);

        // L'ancien contrat reste en vigueur tant que le remplacement n'est pas confirmé.

        // Checkout d'abonnement HÉBERGÉ via le port SubscriptionProvider (Vague 3).
        String forfaitDisplayName = target.substring(0, 1).toUpperCase() + target.substring(1);
        boolean hasCustomer = user.getStripeCustomerId() != null && !user.getStripeCustomerId().isEmpty();

        Map<String, String> metadata = new java.util.HashMap<>();
        metadata.put("type", "upgrade");
        metadata.put("userId", user.getId().toString());
        metadata.put("forfait", target);
        metadata.put("previousForfait", currentForfait);
        if(user.getStripeSubscriptionId()!=null)metadata.put("previousSubscriptionId",user.getStripeSubscriptionId());
        metadata.put("expectedAmount",String.valueOf(priceInCents));
        metadata.put("currency",currency);

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
        log.info("Session d'abonnement upgrade creee");
        return Map.of("checkoutUrl", result.redirectUrl());
    }

    /**
     * Finalise l'upgrade apres confirmation du paiement via webhook Stripe.
     */
    public void completeUpgrade(String sessionId) {
        try {
            Session session = stripeGateway.retrieveSession(sessionId);

            if (session == null || !Objects.equals(sessionId, session.getId()) || session.getMetadata() == null) {
                throw new IllegalStateException("Preuve de session d'abonnement absente");
            }

            String type = session.getMetadata().get("type");
            if (!"upgrade".equals(type)) {
                log.warn("Session {} n'est pas de type upgrade (type={})", sessionId, type);
                return;
            }

            String userIdStr = session.getMetadata().get("userId");
            String targetForfait = session.getMetadata().get("forfait");
            String previousForfait = session.getMetadata().get("previousForfait");

            if (userIdStr == null || targetForfait == null) {
                throw new IllegalStateException("Preuve d'abonnement incomplete");
            }

            Long userId = Long.parseLong(userIdStr);
            User user = userRepository.lockSubscriptionPayer(userId)
                    .orElseThrow(() -> new RuntimeException("Utilisateur id=" + userId + " introuvable"));

            if (!"complete".equals(session.getStatus()) || !"paid".equals(session.getPaymentStatus())
                    || !"subscription".equals(session.getMode()) || session.getSubscription()==null
                    || session.getCustomer()==null || !VALID_FORFAITS.contains(targetForfait)
                    || (user.getStripeCustomerId()!=null && !user.getStripeCustomerId().equals(session.getCustomer())))
                throw new IllegalStateException("Paiement d'abonnement historique non confirmé");

            verifyAmount(session);

            // Un rejeu n'annule rien et ne repete ni l'ecriture ni l'audit.
            if (Objects.equals(user.getStripeSubscriptionId(), session.getSubscription())) return;

            String previousSubscription = nonBlank(session.getMetadata().get("previousSubscriptionId"));
            String currentSubscription = nonBlank(user.getStripeSubscriptionId());
            String currentForfait = user.getForfait() == null ? "essentiel" : user.getForfait().toLowerCase(Locale.ROOT);
            if (!Objects.equals(currentSubscription, previousSubscription)
                    || !Objects.equals(currentForfait, previousForfait)) {
                log.warn("Confirmation upgrade historique obsolete, abonnement courant conserve");
                return;
            }
            if (!VALID_FORFAITS.contains(previousForfait)
                    || FORFAIT_ORDER.get(targetForfait) <= FORFAIT_ORDER.get(previousForfait)) {
                throw new IllegalStateException("Transition de forfait historique incompatible");
            }

            Subscription replacement = stripeGateway.retrieveSubscription(session.getSubscription());
            if (replacement == null || !Objects.equals(replacement.getId(), session.getSubscription())
                    || !Objects.equals(replacement.getCustomer(), session.getCustomer())
                    || !"active".equals(replacement.getStatus())) {
                throw new IllegalStateException("Abonnement de remplacement non confirme");
            }

            if(previousSubscription!=null) {
                var previous=stripeGateway.retrieveSubscription(previousSubscription);
                if(previous == null || !Objects.equals(previousSubscription, previous.getId())
                        || !session.getCustomer().equals(previous.getCustomer()))
                    throw new IllegalStateException("Ancien abonnement étranger au payeur");
                if(!"canceled".equals(previous.getStatus()))stripeGateway.cancelSubscription(previous,SubscriptionCancelParams.builder().setProrate(true).build());
            }

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
                            + " (session " + sessionId + ")");

            log.info("Upgrade forfait termine: {} -> {}", previousForfait, targetForfait);

        } catch (StripeException e) {
            log.error("Erreur Stripe lors de la confirmation de l'upgrade historique");
            throw new RuntimeException("Erreur Stripe lors de la confirmation de l'abonnement");
        }
    }

    private void verifyAmount(Session session) {
        try {
            long expected = Long.parseLong(session.getMetadata().get("expectedAmount"));
            String expectedCurrency = session.getMetadata().get("currency");
            if (expected <= 0 || !Objects.equals(expected, session.getAmountTotal())
                    || !Objects.equals(expected, session.getAmountSubtotal())
                    || expectedCurrency == null || expectedCurrency.isBlank()
                    || !expectedCurrency.equalsIgnoreCase(session.getCurrency())) {
                throw new IllegalStateException("Montant ou devise de l'abonnement incompatible");
            }
        } catch (NumberFormatException failure) {
            throw new IllegalStateException("Montant attendu de l'abonnement absent ou invalide");
        }
    }

    private String nonBlank(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
