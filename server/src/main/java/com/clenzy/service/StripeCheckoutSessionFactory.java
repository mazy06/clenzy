package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Construction des sessions Stripe Checkout (interventions, reservations,
 * upsells, demandes de service) — extrait de {@link StripeService} (G1).
 *
 * <p>Les methodes s'executent dans le contexte transactionnel de l'appelant
 * ({@code StripeService} reste le point d'entree transactionnel + circuit
 * breaker) : comportement strictement identique a l'implementation historique.</p>
 */
@Service
public class StripeCheckoutSessionFactory {

    private static final Logger log = LoggerFactory.getLogger(StripeCheckoutSessionFactory.class);

    private final InterventionRepository interventionRepository;
    private final ReservationRepository reservationRepository;
    private final com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard;
    private final StripeGateway stripeGateway;

    @Value("${stripe.currency}")
    private String currency;

    @Value("${stripe.success-url}")
    private String successUrl;

    @Value("${stripe.cancel-url}")
    private String cancelUrl;

    public StripeCheckoutSessionFactory(InterventionRepository interventionRepository,
                                        ReservationRepository reservationRepository,
                                        com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard,
                                        StripeGateway stripeGateway) {
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.organizationAccessGuard = organizationAccessGuard;
        this.stripeGateway = stripeGateway;
    }

    /** Variante unique HOSTED/EMBEDDED pour les interventions (T-SOLID-4). */
    public Session createInterventionCheckoutSession(Long interventionId, BigDecimal amount,
                                                     String customerEmail, boolean embedded) throws StripeException {
        Intervention intervention = interventionRepository.findById(interventionId)
            .orElseThrow(() -> new NotFoundException("Intervention non trouvee: " + interventionId));
        requireSameOrganization(intervention);

        // Montant résolu côté serveur (le montant client n'est qu'un cross-check)
        BigDecimal chargeAmount = resolveInterventionChargeAmount(intervention, amount);

        SessionCreateParams params = baseCheckoutParams(
                embedded,
                resolveInterventionCurrency(intervention),
                StripeAmounts.toMinorUnits(chargeAmount),
                "Intervention: " + intervention.getTitle(),
                intervention.getDescription() != null
                    ? intervention.getDescription() : "Paiement pour l'intervention",
                customerEmail)
            .putMetadata("intervention_id", interventionId.toString())
            .build();

        Session session = stripeGateway.createSession(params);

        intervention.setStripeSessionId(session.getId());
        intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        interventionRepository.save(intervention);

        return session;
    }

    /**
     * Cree une session de paiement Stripe pour une reservation (envoi par email
     * au guest). Ne modifie pas la reservation (c'est le controller qui le fait).
     * {@code expiresIn} null = comportement historique (lien de paiement email,
     * payable 24h).
     */
    public Session createReservationCheckoutSession(Long reservationId, BigDecimal amount,
                                                    String customerEmail, String guestName,
                                                    String propertyName,
                                                    java.time.Duration expiresIn) throws StripeException {
        return createReservationCheckoutSession(reservationId, amount, customerEmail,
            guestName, propertyName, expiresIn, null);
    }

    /**
     * Variante avec {@code successUrl} explicite (B3, parcours template-driven). {@code successUrl} null
     * = comportement historique ({@code stripe.success-url} par defaut). L'appelant ({@code PublicBookingService})
     * a la responsabilite de N'AVOIR VALIDE cette URL (HTTPS + host de l'org) qu'avant de la passer ici :
     * la factory l'utilise telle quelle, jamais une URL venant directement du client.
     */
    public Session createReservationCheckoutSession(Long reservationId, BigDecimal amount,
                                                    String customerEmail, String guestName,
                                                    String propertyName,
                                                    java.time.Duration expiresIn,
                                                    String successUrl) throws StripeException {
        return createReservationCheckoutSession(reservationId, amount, customerEmail,
            guestName, propertyName, expiresIn, successUrl, null);
    }

    /**
     * Variante alimentant Stripe Radar (P2 — scoring de fraude advisory). {@code riskMetadata}
     * (null/vide = aucun effet) est propagé dans {@code payment_intent_data.metadata} — donc lu par
     * les règles Radar côté Stripe — ET dans la metadata de session (visibilité webhook/dashboard).
     * On NE duplique PAS la logique Radar maison : on lui fournit seulement des signaux (IP réelle,
     * score, niveau). Stripe capte déjà nativement l'IP cliente du checkout hébergé ; la passer en
     * metadata permet en plus de l'exploiter dans des règles Radar custom.
     */
    public Session createReservationCheckoutSession(Long reservationId, BigDecimal amount,
                                                    String customerEmail, String guestName,
                                                    String propertyName,
                                                    java.time.Duration expiresIn,
                                                    String successUrl,
                                                    java.util.Map<String, String> riskMetadata) throws StripeException {
        // Resoudre la devise depuis la reservation
        String resCurrency = reservationRepository.findById(reservationId)
            .map(Reservation::getCurrency)
            .filter(c -> c != null && !c.isBlank())
            .orElse(currency);

        SessionCreateParams.Builder builder = baseCheckoutParams(
                false,
                resCurrency,
                StripeAmounts.toMinorUnits(amount),
                "Reservation: " + propertyName,
                "Paiement pour la reservation de " + (guestName != null ? guestName : "guest"),
                customerEmail,
                successUrl)
            .putMetadata("reservation_id", reservationId.toString())
            .putMetadata("type", "reservation");
        if (expiresIn != null) {
            builder.setExpiresAt(java.time.Instant.now().plus(expiresIn).getEpochSecond());
        }
        applyRiskMetadata(builder, riskMetadata);

        return stripeGateway.createSession(builder.build());
    }

    /**
     * Propage les signaux de risque vers Radar : metadata du PaymentIntent (lue par Radar) + metadata
     * de session. No-op si la map est null/vide (mode advisory désactivé). N'altère jamais le montant
     * ni les paramètres de paiement — purement informatif pour le scoring Stripe.
     */
    private void applyRiskMetadata(SessionCreateParams.Builder builder, java.util.Map<String, String> riskMetadata) {
        if (riskMetadata == null || riskMetadata.isEmpty()) {
            return;
        }
        SessionCreateParams.PaymentIntentData.Builder piData = SessionCreateParams.PaymentIntentData.builder();
        riskMetadata.forEach((k, v) -> {
            if (k != null && v != null) {
                builder.putMetadata(k, v);
                piData.putMetadata(k, v);
            }
        });
        builder.setPaymentIntentData(piData.build());
    }

    // Les méthodes createUpsell* / createServiceRequestSession ont été supprimées
    // (Vague 5) : ces flux passent par PaymentOrchestrationService. Preuve par grep.

    /**
     * Socle commun des sessions Checkout (T-SOLID-4) : mode HOSTED (redirection
     * success/cancel) ou EMBEDDED (clientSecret, cartes uniquement, pas de
     * redirection), line item unique avec montant en centimes et email client
     * optionnel. Les metadata specifiques restent a la charge de l'appelant.
     */
    private SessionCreateParams.Builder baseCheckoutParams(boolean embedded, String currencyCode,
                                                           long amountInCents, String productName,
                                                           String productDescription, String customerEmail) {
        return baseCheckoutParams(embedded, currencyCode, amountInCents, productName,
            productDescription, customerEmail, null);
    }

    /**
     * Variante de {@link #baseCheckoutParams(boolean, String, long, String, String, String)} avec
     * {@code successUrlOverride} optionnel (mode HOSTED uniquement). Null/blank → {@code stripe.success-url}
     * par defaut. Sans effet en mode EMBEDDED (pas de redirection).
     */
    private SessionCreateParams.Builder baseCheckoutParams(boolean embedded, String currencyCode,
                                                           long amountInCents, String productName,
                                                           String productDescription, String customerEmail,
                                                           String successUrlOverride) {
        SessionCreateParams.Builder builder = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT);
        if (embedded) {
            builder.setUiMode(SessionCreateParams.UiMode.EMBEDDED)
                // Never redirect — onComplete callback in the embedded modal handles confirmation
                .setRedirectOnCompletion(SessionCreateParams.RedirectOnCompletion.NEVER)
                // Only card payments — no iDEAL/Klarna/Bancontact that open external tabs
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD);
        } else {
            String effectiveSuccessUrl = (successUrlOverride != null && !successUrlOverride.isBlank())
                ? successUrlOverride : successUrl;
            builder.setSuccessUrl(effectiveSuccessUrl)
                .setCancelUrl(cancelUrl);
        }
        SessionCreateParams.LineItem.PriceData.ProductData.Builder productData =
            SessionCreateParams.LineItem.PriceData.ProductData.builder().setName(productName);
        if (productDescription != null) {
            productData.setDescription(productDescription);
        }
        builder.addLineItem(
            SessionCreateParams.LineItem.builder()
                .setQuantity(1L)
                .setPriceData(
                    SessionCreateParams.LineItem.PriceData.builder()
                        .setCurrency(currencyCode.toLowerCase())
                        .setUnitAmount(amountInCents)
                        .setProductData(productData.build())
                        .build())
                .build());
        if (customerEmail != null && !customerEmail.isBlank()) {
            builder.setCustomerEmail(customerEmail);
        }
        return builder;
    }

    /**
     * Resout la devise pour une intervention : property → config fallback.
     */
    private String resolveInterventionCurrency(Intervention intervention) {
        // 1. Depuis la propriete
        if (intervention.getProperty() != null && intervention.getProperty().getDefaultCurrency() != null
                && !intervention.getProperty().getDefaultCurrency().isBlank()) {
            return intervention.getProperty().getDefaultCurrency();
        }
        // 2. Fallback config
        return currency;
    }

    /**
     * Refuse l'acces si l'intervention appartient a une autre organisation.
     * Delegue a {@link com.clenzy.service.access.OrganizationAccessGuard}
     * (fail-closed, bypass platform staff + org SYSTEM), que findById ne traverse pas.
     */
    private void requireSameOrganization(Intervention intervention) {
        organizationAccessGuard.requireSameOrganization(
                intervention.getOrganizationId(), "Intervention hors de votre organisation");
    }

    /**
     * Resout le montant a facturer pour une intervention : toujours le montant
     * serveur ({@code estimatedCost}). Le montant fourni par le client n'est
     * accepte que s'il est strictement egal (cross-check, Z3-SEC-01).
     */
    private BigDecimal resolveInterventionChargeAmount(Intervention intervention, BigDecimal clientAmount) {
        BigDecimal serverAmount = intervention.getEstimatedCost();
        if (serverAmount == null || serverAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException(
                "Montant indisponible pour l'intervention " + intervention.getId() + " — paiement impossible");
        }
        if (clientAmount != null && clientAmount.compareTo(serverAmount) != 0) {
            throw new IllegalArgumentException(
                "Le montant fourni ne correspond pas au montant attendu de l'intervention " + intervention.getId());
        }
        return serverAmount;
    }

    /**
     * Charge une demande de service et valide qu'elle est payable :
     * statut AWAITING_PAYMENT (assignee, en attente de paiement) et montant
     * serveur strictement positif.
     */
}
