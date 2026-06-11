package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.LedgerReferenceType;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.Wallet;
import com.clenzy.model.WalletType;
import com.clenzy.config.KafkaConfig;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@Transactional
public class StripeService {

    private static final Logger log = LoggerFactory.getLogger(StripeService.class);

    private final InterventionRepository interventionRepository;
    private final ReservationRepository reservationRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final NotificationService notificationService;
    private final ServiceRequestService serviceRequestService;
    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final SplitPaymentService splitPaymentService;
    private final AutoInvoiceService autoInvoiceService;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard;
    private final StripeGateway stripeGateway;
    private final PaymentStatusTransitionService paymentStatusTransitionService;
    private final PaymentLedgerReversalService paymentLedgerReversalService;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${stripe.currency}")
    private String currency;

    @Value("${stripe.success-url}")
    private String successUrl;

    @Value("${stripe.cancel-url}")
    private String cancelUrl;

    @Value("${stripe.embedded-return-url:#{null}}")
    private String embeddedReturnUrl;

    public StripeService(InterventionRepository interventionRepository,
                         ReservationRepository reservationRepository,
                         ServiceRequestRepository serviceRequestRepository,
                         NotificationService notificationService,
                         ServiceRequestService serviceRequestService,
                         WalletService walletService,
                         LedgerService ledgerService,
                         SplitPaymentService splitPaymentService,
                         AutoInvoiceService autoInvoiceService,
                         KafkaTemplate<String, Object> kafkaTemplate,
                         com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard,
                         StripeGateway stripeGateway,
                         PaymentStatusTransitionService paymentStatusTransitionService,
                         PaymentLedgerReversalService paymentLedgerReversalService) {
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.notificationService = notificationService;
        this.serviceRequestService = serviceRequestService;
        this.walletService = walletService;
        this.ledgerService = ledgerService;
        this.splitPaymentService = splitPaymentService;
        this.autoInvoiceService = autoInvoiceService;
        this.kafkaTemplate = kafkaTemplate;
        this.organizationAccessGuard = organizationAccessGuard;
        this.stripeGateway = stripeGateway;
        this.paymentStatusTransitionService = paymentStatusTransitionService;
        this.paymentLedgerReversalService = paymentLedgerReversalService;
    }

    /**
     * Crée une session de paiement Stripe pour une intervention.
     *
     * <p>Le montant facturé est TOUJOURS résolu côté serveur depuis
     * {@code intervention.getEstimatedCost()} (Z3-SEC-01 / Z3-BUGS-02). Le
     * paramètre {@code amount} fourni par l'appelant n'est qu'un cross-check :
     * s'il diffère du montant serveur, l'appel est rejeté.</p>
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createCheckoutSession(Long interventionId, BigDecimal amount, String customerEmail) throws StripeException {
        return createInterventionCheckoutSession(interventionId, amount, customerEmail, false);
    }

    /**
     * Cree une session de paiement Stripe en mode EMBEDDED (inline dans l'interface).
     * Retourne une session avec un clientSecret utilisable cote frontend
     * via EmbeddedCheckoutProvider de @stripe/react-stripe-js.
     *
     * <p>Comme {@link #createCheckoutSession}, le montant facturé est résolu
     * côté serveur ; {@code amount} n'est qu'un cross-check.</p>
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createEmbeddedCheckoutSession(Long interventionId, BigDecimal amount, String customerEmail) throws StripeException {
        return createInterventionCheckoutSession(interventionId, amount, customerEmail, true);
    }

    /** Variante unique HOSTED/EMBEDDED pour les interventions (T-SOLID-4). */
    private Session createInterventionCheckoutSession(Long interventionId, BigDecimal amount,
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
     * Socle commun des sessions Checkout (T-SOLID-4) : mode HOSTED (redirection
     * success/cancel) ou EMBEDDED (clientSecret, cartes uniquement, pas de
     * redirection), line item unique avec montant en centimes et email client
     * optionnel. Les metadata specifiques restent a la charge de l'appelant.
     */
    private SessionCreateParams.Builder baseCheckoutParams(boolean embedded, String currencyCode,
                                                           long amountInCents, String productName,
                                                           String productDescription, String customerEmail) {
        SessionCreateParams.Builder builder = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT);
        if (embedded) {
            builder.setUiMode(SessionCreateParams.UiMode.EMBEDDED)
                // Never redirect — onComplete callback in the embedded modal handles confirmation
                .setRedirectOnCompletion(SessionCreateParams.RedirectOnCompletion.NEVER)
                // Only card payments — no iDEAL/Klarna/Bancontact that open external tabs
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD);
        } else {
            builder.setSuccessUrl(successUrl)
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
     * Crée une session de paiement Stripe pour une réservation (envoi par email au guest).
     * Ne modifie pas la réservation (c'est le controller qui le fait).
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createReservationCheckoutSession(Long reservationId, BigDecimal amount,
                                                     String customerEmail, String guestName,
                                                     String propertyName) throws StripeException {
        return createReservationCheckoutSession(reservationId, amount, customerEmail,
            guestName, propertyName, null);
    }

    /**
     * Variante avec duree de vie explicite de la session ({@code expires_at}).
     * Utilisee par le flux booking engine {@code /reserve} + {@code /checkout} :
     * le hold pending expire a 30 min, la session Stripe doit devenir
     * inutilisable dans la foulee (~35 min, minimum Stripe : 30 min) — sinon un
     * guest pouvait encore payer 24h apres la liberation des dates (reliquat
     * revue A3). {@code expiresIn} null = comportement historique (lien de
     * paiement email, payable 24h).
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createReservationCheckoutSession(Long reservationId, BigDecimal amount,
                                                     String customerEmail, String guestName,
                                                     String propertyName,
                                                     java.time.Duration expiresIn) throws StripeException {
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
                customerEmail)
            .putMetadata("reservation_id", reservationId.toString())
            .putMetadata("type", "reservation");
        if (expiresIn != null) {
            builder.setExpiresAt(java.time.Instant.now().plus(expiresIn).getEpochSecond());
        }

        return stripeGateway.createSession(builder.build());
    }

    /**
     * Cree une session Stripe EMBEDDED pour un upsell guest (clientSecret cote livret).
     * Chargee sur le compte plateforme comme les reservations ; la repartition part
     * hote / part plateforme est creditee au ledger a la confirmation du paiement
     * (cf. UpsellService.markPaidBySession via le webhook checkout.session.completed).
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createUpsellCheckoutSession(Long upsellOrderId, BigDecimal amount, String currencyCode,
                                               String title, String customerEmail) throws StripeException {
        String cur = (currencyCode != null && !currencyCode.isBlank()) ? currencyCode : currency;

        SessionCreateParams params = baseCheckoutParams(
                true, cur, StripeAmounts.toMinorUnits(amount), title, null, customerEmail)
            .putMetadata("type", "upsell")
            .putMetadata("upsell_order_id", upsellOrderId.toString())
            .build();

        return stripeGateway.createSession(params);
    }

    /**
     * Re-verifie cote serveur si une session Checkout est payee (filet de secours
     * quand le webhook tarde/echoue). Interroge directement l'API Stripe.
     *
     * <p>Contrat best-effort assume (T-SOLID-7) : une erreur de l'API Stripe est
     * loggee et traduite en {@code false} (paiement non confirme, le webhook ou
     * un re-essai ulterieur tranchera) ; seuls les {@link StripeException} sont
     * absorbees, un bug applicatif remonte normalement.</p>
     */
    @CircuitBreaker(name = "stripe-api")
    public boolean isCheckoutSessionPaid(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return false;
        }
        try {
            Session session = stripeGateway.retrieveSession(sessionId);
            return session != null && "paid".equals(session.getPaymentStatus());
        } catch (StripeException e) {
            log.warn("Stripe session retrieve failed for {}: {}", sessionId, e.getMessage());
            return false;
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Expiration / remboursement de sessions Checkout (Z4A-BUGS-02 / Z4A-BUGS-03)
    // ════════════════════════════════════════════════════════════════════════

    /** Resultat de la tentative d'expiration d'une session Checkout. */
    public enum CheckoutSessionExpiryResult {
        /** Session expiree (ou deja expiree / absente) : le calendrier peut etre libere. */
        EXPIRED,
        /** Session deja payee (paiement tardif / race) : NE PAS liberer, reconcilier. */
        PAID,
        /** Session complete mais paiement asynchrone non confirme : NE PAS liberer. */
        COMPLETED_UNPAID,
        /** Appel Stripe en echec, statut inconnu : NE PAS liberer (re-essai ulterieur). */
        FAILED
    }

    /**
     * Expire une session Stripe Checkout encore ouverte afin qu'un guest ne puisse
     * plus payer une reservation sur le point d'etre annulee (Z4A-BUGS-02).
     *
     * <p>A appeler AVANT toute liberation de calendrier : seul un resultat
     * {@link CheckoutSessionExpiryResult#EXPIRED} autorise la liberation des dates.
     * Si la session est deja payee (race expiration / paiement), l'appelant doit
     * reconcilier (confirmer la reservation) au lieu de liberer.</p>
     */
    @CircuitBreaker(name = "stripe-api")
    public CheckoutSessionExpiryResult expireCheckoutSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return CheckoutSessionExpiryResult.EXPIRED;
        }
        try {
            Session session = stripeGateway.retrieveSession(sessionId);
            CheckoutSessionExpiryResult state = classifySessionForExpiry(session);
            if (state != null) {
                return state;
            }
            session.expire(com.stripe.net.RequestOptions.builder().setApiKey(stripeSecretKey).build());
            log.info("Session Checkout {} expiree (annulation reservation)", sessionId);
            return CheckoutSessionExpiryResult.EXPIRED;
        } catch (StripeException e) {
            return resolveExpiryAfterStripeError(sessionId, e);
        }
    }

    /** @return l'etat final si la session n'est pas expirable, {@code null} si elle est encore ouverte. */
    private CheckoutSessionExpiryResult classifySessionForExpiry(Session session) {
        if (session == null || "expired".equals(session.getStatus())) {
            return CheckoutSessionExpiryResult.EXPIRED;
        }
        if ("paid".equals(session.getPaymentStatus())) {
            return CheckoutSessionExpiryResult.PAID;
        }
        if ("complete".equals(session.getStatus())) {
            return CheckoutSessionExpiryResult.COMPLETED_UNPAID;
        }
        return null;
    }

    /**
     * Apres un echec d'expiration, re-lit la session : la cause la plus probable
     * est une completion concurrente (le guest vient de payer). Dans le doute,
     * retourne FAILED pour interdire la liberation du calendrier.
     */
    private CheckoutSessionExpiryResult resolveExpiryAfterStripeError(String sessionId, StripeException original) {
        try {
            Session session = stripeGateway.retrieveSession(sessionId);
            CheckoutSessionExpiryResult state = classifySessionForExpiry(session);
            if (state != null) {
                return state;
            }
        } catch (StripeException retryEx) {
            log.warn("Expiration session Checkout {} : relecture impossible ({})", sessionId, retryEx.getMessage());
        }
        log.warn("Expiration session Checkout {} en echec : {}", sessionId, original.getMessage());
        return CheckoutSessionExpiryResult.FAILED;
    }

    /**
     * Rembourse integralement le paiement d'une session Checkout (Z4A-BUGS-03 :
     * paiement recu alors que les dates ne sont plus disponibles, ou montant
     * divergent du devis serveur). Idempotent cote Stripe via une idempotency key
     * derivee de la session : un re-essai ne produit pas de second remboursement.
     */
    @CircuitBreaker(name = "stripe-api")
    public void refundCheckoutSessionPayment(String sessionId, String reason) throws StripeException {
        Session session = stripeGateway.retrieveSession(sessionId);
        String paymentIntentId = session != null ? session.getPaymentIntent() : null;
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new IllegalStateException("Aucun PaymentIntent trouve pour la session: " + sessionId);
        }
        RefundCreateParams params = RefundCreateParams.builder()
            .setPaymentIntent(paymentIntentId)
            .build();
        stripeGateway.createRefund(params, "refund-checkout-session-" + sessionId);
        log.warn("Remboursement automatique emis pour la session {} : {}", sessionId, reason);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Wallet creation on payment confirmation
    // ════════════════════════════════════════════════════════════════════════

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
     * Ensures wallets exist for the organization and records the payment in the ledger.
     * Creates PLATFORM wallet (org-level) and OWNER wallet (property owner) if they don't exist.
     * Then records a ledger entry: ESCROW → PLATFORM for the payment amount.
     *
     * @param orgId        Organization ID
     * @param ownerId      Property owner user ID (nullable)
     * @param amount       Payment amount
     * @param currencyCode Devise reellement chargee sur la session Stripe (Z3-BUGS-05)
     * @param refType      Reference type for the ledger
     * @param refId        Reference ID (e.g., "intervention-123")
     * @param description  Human-readable description
     */
    private void ensureWalletsAndRecordPayment(Long orgId, Long ownerId, Long propertyId,
                                                BigDecimal amount, String currencyCode,
                                                String refType, String refId, String description) {
        try {
            String curr = normalizeCurrency(currencyCode);

            // Ensure platform wallet exists
            Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, curr);

            // Ensure escrow wallet exists (incoming payments land here first)
            Wallet escrowWallet = walletService.getOrCreateEscrowWallet(orgId, curr);

            // Ensure owner wallet exists if we have an owner
            if (ownerId != null) {
                walletService.getOrCreateWallet(orgId, WalletType.OWNER, ownerId, curr);
            }

            // Record ledger entry: escrow → platform (payment received)
            if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
                ledgerService.recordTransfer(
                    escrowWallet, platformWallet, amount,
                    LedgerReferenceType.PAYMENT, refId, description
                );
            }

            log.info("Wallets ensured and payment recorded for org={}, ref={}, amount={} {}",
                orgId, refId, amount, curr);

            // ─── Split revenue: PLATFORM → OWNER + CONCIERGE ─────────────────
            // propertyId is used to detect if a concierge (ManagementContract) is involved.
            // If no concierge, the concierge share is redirected to the owner.
            if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
                try {
                    splitPaymentService.splitGenericPayment(amount, curr, ownerId, propertyId, refType, refId);
                } catch (Exception splitEx) {
                    log.error("Split failed for ref={}, payment still confirmed: {}", refId, splitEx.getMessage(), splitEx);
                    notifyLedgerReconciliationRequired(refType, refId,
                        "repartition des revenus (split) non enregistree");
                }
            }
        } catch (Exception e) {
            // Contrat best-effort assume (T-BP-07) : un echec wallet/ledger ne doit
            // pas bloquer la confirmation du paiement (deja encaisse cote Stripe),
            // mais il ne doit plus etre silencieux — les admins sont notifies pour
            // reconciliation manuelle.
            log.error("Error ensuring wallets/recording payment for ref={}: {}", refId, e.getMessage(), e);
            notifyLedgerReconciliationRequired(refType, refId, "ecriture ledger du paiement non enregistree");
        }
    }

    /**
     * Overload for reservation payments: uses splitPayment() with reservationId
     * for ManagementContract-aware split ratios.
     */
    private void ensureWalletsAndRecordPaymentForReservation(Long orgId, Long ownerId, BigDecimal amount,
                                                               String currencyCode,
                                                               Long reservationId, String refId, String description) {
        try {
            String curr = normalizeCurrency(currencyCode);

            Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, curr);
            Wallet escrowWallet = walletService.getOrCreateEscrowWallet(orgId, curr);
            if (ownerId != null) {
                walletService.getOrCreateWallet(orgId, WalletType.OWNER, ownerId, curr);
            }

            if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
                ledgerService.recordTransfer(
                    escrowWallet, platformWallet, amount,
                    LedgerReferenceType.PAYMENT, refId, description
                );
            }

            log.info("Wallets ensured and payment recorded for reservation org={}, ref={}, amount={} {}",
                orgId, refId, amount, curr);

            // Split with reservation context (ManagementContract → SplitConfig → defaults)
            if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
                try {
                    splitPaymentService.splitPayment(reservationId, amount, curr, ownerId);
                } catch (Exception splitEx) {
                    log.error("Split failed for reservation {}, payment still confirmed: {}",
                        reservationId, splitEx.getMessage(), splitEx);
                    notifyLedgerReconciliationRequired("reservation", refId,
                        "repartition des revenus (split) non enregistree");
                }
            }
        } catch (Exception e) {
            // Voir ensureWalletsAndRecordPayment : best-effort assume + alerte admin (T-BP-07).
            log.error("Error ensuring wallets/recording payment for reservation ref={}: {}", refId, e.getMessage(), e);
            notifyLedgerReconciliationRequired("reservation", refId,
                "ecriture ledger du paiement non enregistree");
        }
    }

    /**
     * Alerte les admins/managers qu'une ecriture comptable attendue manque
     * (T-BP-07) : le paiement est confirme cote Stripe mais le ledger/split a
     * echoue — sans cette alerte, la divergence n'etait visible que dans les logs.
     * Best-effort : un echec de notification est logge sans bloquer le flux.
     */
    private void notifyLedgerReconciliationRequired(String refType, String refId, String detail) {
        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.RECONCILIATION_FAILED,
                "Reconciliation ledger requise",
                "Paiement confirme mais " + detail + " pour " + refType + " #" + refId
                    + ". Verifier les soldes wallets/ledger.",
                "/billing"
            );
        } catch (Exception notifyEx) {
            log.error("Impossible de notifier la reconciliation ledger requise pour {} #{}: {}",
                refType, refId, notifyEx.getMessage());
        }
    }

    /** Devise du ledger = devise de la charge reelle ; fallback config puis EUR. */
    private String normalizeCurrency(String currencyCode) {
        if (currencyCode != null && !currencyCode.isBlank()) {
            return currencyCode.toUpperCase();
        }
        return (currency != null && !currency.isBlank()) ? currency.toUpperCase() : "EUR";
    }

    /**
     * Confirme le paiement d'une intervention après réception du webhook.
     *
     * <p>Idempotent (Z3-BUGS-01) : si l'intervention est déjà PAID, ou si une
     * confirmation concurrente a gagné la transition gardée, le traitement est
     * abandonné sans nouvelle écriture ledger/split.</p>
     */
    public void confirmPayment(String sessionId) {
        // Use the no-orgId variant because this is called from the Stripe webhook (no tenant context)
        Intervention intervention = interventionRepository.findByStripeSessionId(sessionId)
            .orElseThrow(() -> new NotFoundException("Intervention non trouvee pour la session: " + sessionId));

        if (intervention.getPaymentStatus() == PaymentStatus.PAID) {
            log.info("Paiement deja confirme pour la session {} — traitement ignore (idempotence)", sessionId);
            return;
        }
        if (!paymentStatusTransitionService.markInterventionPaid(intervention.getId())) {
            log.info("Confirmation concurrente detectee pour l'intervention {} — traitement ignore",
                intervention.getId());
            return;
        }

        intervention.setPaymentStatus(PaymentStatus.PAID);
        intervention.setPaidAt(LocalDateTime.now());
        // Changer le statut de l'intervention de AWAITING_PAYMENT à PENDING (prête à être planifiée)
        if (intervention.getStatus() == InterventionStatus.AWAITING_PAYMENT) {
            intervention.setStatus(InterventionStatus.PENDING);
        }
        interventionRepository.save(intervention);

        // ─── Wallet creation + ledger entry ──────────────────────────────────
        Long ownerId = (intervention.getProperty() != null && intervention.getProperty().getOwner() != null)
                ? intervention.getProperty().getOwner().getId() : null;
        Long propertyId = (intervention.getProperty() != null) ? intervention.getProperty().getId() : null;
        ensureWalletsAndRecordPayment(
            intervention.getOrganizationId(), ownerId, propertyId,
            intervention.getEstimatedCost(),
            resolveInterventionCurrency(intervention),
            "intervention", String.valueOf(intervention.getId()),
            "Paiement intervention: " + intervention.getTitle()
        );

        try {
            if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    && intervention.getProperty().getOwner().getKeycloakId() != null) {
                notificationService.notify(
                    intervention.getProperty().getOwner().getKeycloakId(),
                    NotificationKey.PAYMENT_CONFIRMED,
                    "Paiement confirme",
                    "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a ete confirme",
                    "/interventions/" + intervention.getId()
                );
            }
            // Notifier également les admins/managers
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYMENT_CONFIRMED,
                "Paiement confirme",
                "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a ete confirme",
                "/interventions/" + intervention.getId()
            );

            // Notifier les admins/managers qu'une action d'assignation est requise
            notificationService.notifyAdminsAndManagers(
                NotificationKey.INTERVENTION_AWAITING_VALIDATION,
                "Action requise : assignation",
                "L'intervention \"" + intervention.getTitle() + "\" est payee et en attente d'assignation d'equipe.",
                "/interventions"
            );
        } catch (Exception e) {
            log.warn("Erreur notification PAYMENT_CONFIRMED: {}", e.getMessage());
        }

        publishInterventionPaymentDocuments(intervention);

        // ─── Auto-generation facture fiscale (entite Invoice) ──────────────
        try {
            autoInvoiceService.generateForIntervention(intervention);
        } catch (Exception e) {
            log.warn("Auto-invoice failed for intervention {}: {}", intervention.getId(), e.getMessage());
        }
    }

    /** Publie les evenements Kafka FACTURE + JUSTIFICATIF_PAIEMENT d'une intervention. */
    private void publishInterventionPaymentDocuments(Intervention intervention) {
        try {
            String emailTo = (intervention.getProperty() != null && intervention.getProperty().getOwner() != null)
                    ? intervention.getProperty().getOwner().getEmail() : "";

            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "facture-int-" + intervention.getId(),
                Map.of(
                    "documentType", "FACTURE",
                    "referenceId", intervention.getId(),
                    "referenceType", "intervention",
                    "emailTo", emailTo != null ? emailTo : ""
                )
            );

            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "justif-paiement-int-" + intervention.getId(),
                Map.of(
                    "documentType", "JUSTIFICATIF_PAIEMENT",
                    "referenceId", intervention.getId(),
                    "referenceType", "intervention",
                    "emailTo", emailTo != null ? emailTo : ""
                )
            );
            log.debug("Evenements FACTURE + JUSTIFICATIF_PAIEMENT publies sur Kafka pour l'intervention: {}", intervention.getId());
        } catch (Exception e) {
            log.error("Erreur publication Kafka FACTURE/JUSTIFICATIF_PAIEMENT: {}", e.getMessage());
        }
    }

    /**
     * Marque un paiement comme échoué
     */
    public void markPaymentAsFailed(String sessionId) {
        // Use the no-orgId variant because this is called from the Stripe webhook (no tenant context)
        Intervention intervention = interventionRepository.findByStripeSessionId(sessionId)
            .orElse(null);

        if (intervention != null) {
            intervention.setPaymentStatus(PaymentStatus.FAILED);
            interventionRepository.save(intervention);

            try {
                // Notify property owner
                if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                        && intervention.getProperty().getOwner().getKeycloakId() != null) {
                    notificationService.notify(
                        intervention.getProperty().getOwner().getKeycloakId(),
                        NotificationKey.PAYMENT_FAILED,
                        "Echec du paiement",
                        "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a echoue",
                        "/interventions/" + intervention.getId()
                    );
                }
                // Also notify admins/managers
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.PAYMENT_FAILED,
                    "Echec du paiement",
                    "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a echoue",
                    "/interventions/" + intervention.getId()
                );
            } catch (Exception e) {
                log.warn("Erreur notification PAYMENT_FAILED: {}", e.getMessage());
            }
        }
    }

    /**
     * Confirme le paiement d'une reservation apres reception du webhook Stripe.
     * Appele depuis le webhook (pas de tenant context — recherche par stripeSessionId sans orgId).
     *
     * <p>Idempotent (Z3-SEC-02) : early-return si deja PAID + transition gardee
     * contre la course webhook / fallback authentifie.</p>
     */
    public void confirmReservationPayment(String sessionId) {
        Reservation reservation = reservationRepository.findByStripeSessionId(sessionId)
            .orElseThrow(() -> new NotFoundException("Reservation non trouvee pour la session: " + sessionId));

        if (reservation.getPaymentStatus() == PaymentStatus.PAID) {
            log.info("Paiement reservation deja confirme pour la session {} — traitement ignore (idempotence)", sessionId);
            return;
        }
        if (!paymentStatusTransitionService.markReservationPaid(reservation.getId())) {
            log.info("Confirmation concurrente detectee pour la reservation {} — traitement ignore",
                reservation.getId());
            return;
        }

        reservation.setPaymentStatus(PaymentStatus.PAID);
        reservation.setPaidAt(LocalDateTime.now());
        // Z4A-BUGS-05 : un paiement valide confirme la reservation — sans cette
        // transition une resa payee resterait "pending" indefiniment (PMS + guest).
        if ("pending".equalsIgnoreCase(reservation.getStatus())) {
            reservation.setStatus("confirmed");
        }
        reservationRepository.save(reservation);

        log.info("Paiement de reservation confirme: reservationId={}, sessionId={}", reservation.getId(), sessionId);

        // ─── Wallet creation + ledger entry + split (ManagementContract-aware) ──
        Long ownerId = (reservation.getProperty() != null && reservation.getProperty().getOwner() != null)
                ? reservation.getProperty().getOwner().getId() : null;
        ensureWalletsAndRecordPaymentForReservation(
            reservation.getOrganizationId(), ownerId,
            reservation.getTotalPrice(),
            reservation.getCurrency(),
            reservation.getId(),
            String.valueOf(reservation.getId()),
            "Paiement reservation: " + (reservation.getGuestName() != null ? reservation.getGuestName() : "guest")
        );

        // Notifications
        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYMENT_CONFIRMED,
                "Paiement reservation confirme",
                "Le paiement pour la reservation de " + (reservation.getGuestName() != null ? reservation.getGuestName() : "guest")
                    + " (" + (reservation.getProperty() != null ? reservation.getProperty().getName() : "N/A") + ") a ete confirme",
                "/reservations/" + reservation.getId()
            );
        } catch (Exception e) {
            log.warn("Erreur notification PAYMENT_CONFIRMED (reservation): {}", e.getMessage());
        }

        // Generation automatique FACTURE + JUSTIFICATIF_PAIEMENT
        try {
            String emailTo = "";
            if (reservation.getPaymentLinkEmail() != null) {
                emailTo = reservation.getPaymentLinkEmail();
            }

            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "facture-resa-" + reservation.getId(),
                Map.of(
                    "documentType", "FACTURE",
                    "referenceId", reservation.getId(),
                    "referenceType", "reservation",
                    "emailTo", emailTo
                )
            );

            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "justif-paiement-resa-" + reservation.getId(),
                Map.of(
                    "documentType", "JUSTIFICATIF_PAIEMENT",
                    "referenceId", reservation.getId(),
                    "referenceType", "reservation",
                    "emailTo", emailTo
                )
            );
            log.debug("Evenements FACTURE + JUSTIFICATIF_PAIEMENT publies sur Kafka pour la reservation: {}", reservation.getId());
        } catch (Exception e) {
            log.error("Erreur publication Kafka FACTURE/JUSTIFICATIF_PAIEMENT (reservation): {}", e.getMessage());
        }

        // ─── Auto-generation facture fiscale (entite Invoice) ──────────────
        try {
            autoInvoiceService.generateForReservation(reservation);
        } catch (Exception e) {
            log.warn("Auto-invoice failed for reservation {}: {}", reservation.getId(), e.getMessage());
        }
    }

    /**
     * Marque le paiement d'une reservation comme echoue.
     */
    public void markReservationPaymentFailed(String sessionId) {
        Reservation reservation = reservationRepository.findByStripeSessionId(sessionId)
            .orElse(null);

        if (reservation != null) {
            reservation.setPaymentStatus(PaymentStatus.FAILED);
            reservationRepository.save(reservation);
            log.warn("Paiement de reservation echoue: reservationId={}, sessionId={}", reservation.getId(), sessionId);

            try {
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.PAYMENT_FAILED,
                    "Echec paiement reservation",
                    "Le paiement pour la reservation de " + (reservation.getGuestName() != null ? reservation.getGuestName() : "guest")
                        + " (" + (reservation.getProperty() != null ? reservation.getProperty().getName() : "N/A") + ") a echoue",
                    "/reservations/" + reservation.getId()
                );
            } catch (Exception e) {
                log.warn("Erreur notification PAYMENT_FAILED (reservation): {}", e.getMessage());
            }
        }
    }

    /**
     * Confirme le paiement groupe de plusieurs interventions (paiement differe).
     * Chaque intervention incluse passe en PAID. Les interventions deja payees
     * sont ignorees (idempotence).
     */
    public void confirmGroupedPayment(String sessionId, String interventionIds) {
        if (interventionIds == null || interventionIds.isBlank()) return;

        String[] ids = interventionIds.split(",");
        for (String idStr : ids) {
            try {
                Long id = Long.parseLong(idStr.trim());
                confirmGroupedIntervention(sessionId, id);
            } catch (NumberFormatException e) {
                // T-BP-04 : un id corrompu dans les metadata Stripe laisse
                // l'intervention non confirmee alors que le paiement est encaisse —
                // tracer pour permettre la reconciliation manuelle.
                log.error("Paiement groupe session {} : id d'intervention invalide '{}' dans les metadata "
                    + "Stripe — intervention non confirmee, reconciliation manuelle requise", sessionId, idStr);
            }
        }
    }

    private void confirmGroupedIntervention(String sessionId, Long id) {
        Intervention intervention = interventionRepository.findById(id).orElse(null);
        if (intervention == null) {
            return;
        }
        if (intervention.getPaymentStatus() == PaymentStatus.PAID) {
            log.info("Intervention {} deja payee — ignoree (idempotence, paiement groupe)", id);
            return;
        }
        if (!paymentStatusTransitionService.markInterventionPaid(id)) {
            log.info("Confirmation concurrente detectee pour l'intervention {} (paiement groupe) — ignoree", id);
            return;
        }

        intervention.setPaymentStatus(PaymentStatus.PAID);
        intervention.setPaidAt(LocalDateTime.now());
        intervention.setStripeSessionId(sessionId);
        interventionRepository.save(intervention);

        // ─── Wallet creation + ledger entry ──────────────────────────────────
        // Les sessions groupees sont facturees dans la devise de config (DeferredPaymentService).
        Long ownerId = (intervention.getProperty() != null && intervention.getProperty().getOwner() != null)
                ? intervention.getProperty().getOwner().getId() : null;
        Long propId = (intervention.getProperty() != null) ? intervention.getProperty().getId() : null;
        ensureWalletsAndRecordPayment(
            intervention.getOrganizationId(), ownerId, propId,
            intervention.getEstimatedCost(),
            currency,
            "intervention", String.valueOf(intervention.getId()),
            "Paiement intervention (groupe): " + intervention.getTitle()
        );

        publishInterventionPaymentDocuments(intervention);

        // ─── Auto-generation facture fiscale (entite Invoice) ──────────────
        try {
            autoInvoiceService.generateForIntervention(intervention);
        } catch (Exception e) {
            log.warn("Auto-invoice failed for grouped intervention {}: {}", intervention.getId(), e.getMessage());
        }
    }

    /**
     * Marque le paiement groupe comme echoue pour toutes les interventions incluses.
     */
    public void markGroupedPaymentAsFailed(String interventionIds) {
        if (interventionIds == null || interventionIds.isBlank()) return;

        String[] ids = interventionIds.split(",");
        for (String idStr : ids) {
            try {
                Long id = Long.parseLong(idStr.trim());
                Intervention intervention = interventionRepository.findById(id).orElse(null);
                if (intervention != null) {
                    intervention.setPaymentStatus(PaymentStatus.FAILED);
                    interventionRepository.save(intervention);
                }
            } catch (NumberFormatException e) {
                // T-BP-04 : tracer l'id corrompu — l'intervention concernee reste
                // dans son statut precedent au lieu de passer FAILED.
                log.warn("Echec paiement groupe : id d'intervention invalide '{}' dans les metadata Stripe "
                    + "— statut FAILED non applique", idStr);
            }
        }
    }

    /**
     * Rembourse un paiement via Stripe et met a jour le statut de l'intervention.
     *
     * <p>Pattern anti double-remboursement (Z3-BUGS-06) : les donnees sont
     * preparees dans une transaction courte, l'appel Stripe (effet externe
     * irreversible) est emis HORS transaction avec une idempotency key derivee
     * de l'intervention, puis le resultat est persiste dans une nouvelle
     * transaction. Un re-essai apres echec de persistance rejoue la meme
     * idempotency key : Stripe renvoie le meme remboursement, aucun double debit.</p>
     */
    @CircuitBreaker(name = "stripe-api")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void refundPayment(Long interventionId) throws StripeException {
        PaymentStatusTransitionService.InterventionRefundContext ctx =
            paymentStatusTransitionService.loadRefundableIntervention(interventionId);

        String paymentIntentId = resolvePaymentIntentId(ctx.stripeSessionId());

        // Remboursement total — hors transaction DB, idempotent cote Stripe
        RefundCreateParams refundParams = RefundCreateParams.builder()
            .setPaymentIntent(paymentIntentId)
            .build();
        stripeGateway.createRefund(refundParams, "refund-intervention-" + interventionId);

        persistRefundResult(interventionId);
        recordRefundLedgerReversal(interventionId);
        notifyRefundCompleted(ctx);
        publishRefundDocumentEvent(ctx);
    }

    /**
     * Contre-passe les ecritures ledger du paiement rembourse (Z3-BUGS-06) :
     * sans cela, les credits ESCROW→PLATFORM et le split restaient en place
     * apres remboursement (soldes wallets surevalues). Best-effort assume : le
     * remboursement Stripe est deja parti et le statut REFUNDED persiste — un
     * echec ici declenche une alerte de reconciliation au lieu de faire echouer
     * l'operation (qui ne pourrait plus etre annulee cote Stripe).
     */
    private void recordRefundLedgerReversal(Long interventionId) {
        try {
            paymentLedgerReversalService.reverseInterventionPaymentEntries(interventionId);
        } catch (Exception e) {
            log.error("Remboursement intervention {} : contre-passation ledger en echec — "
                + "reconciliation requise", interventionId, e);
            notifyLedgerReconciliationRequired("intervention", String.valueOf(interventionId),
                "contre-passation ledger du remboursement non enregistree");
        }
    }

    private String resolvePaymentIntentId(String sessionId) throws StripeException {
        Session session = stripeGateway.retrieveSession(sessionId);
        String paymentIntentId = (session != null) ? session.getPaymentIntent() : null;
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new IllegalStateException("Aucun PaymentIntent trouve pour la session: " + sessionId);
        }
        return paymentIntentId;
    }

    private void persistRefundResult(Long interventionId) {
        try {
            paymentStatusTransitionService.markInterventionRefunded(interventionId);
        } catch (Exception e) {
            log.error("Remboursement Stripe emis pour l'intervention {} mais la persistance du statut a echoue — "
                + "reconciliation requise. Relancer l'operation est sans risque (idempotency key refund-intervention-{}).",
                interventionId, interventionId, e);
            throw new IllegalStateException(
                "Remboursement emis cote Stripe mais la mise a jour du statut a echoue — relancer l'operation.", e);
        }
    }

    private void notifyRefundCompleted(PaymentStatusTransitionService.InterventionRefundContext ctx) {
        try {
            if (ctx.ownerKeycloakId() != null) {
                notificationService.notify(
                    ctx.ownerKeycloakId(),
                    NotificationKey.PAYMENT_REFUND_COMPLETED,
                    "Remboursement effectue",
                    "Le paiement pour l'intervention \"" + ctx.title() + "\" a ete rembourse",
                    "/interventions/" + ctx.interventionId()
                );
            }
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYMENT_REFUND_COMPLETED,
                "Remboursement effectue",
                "Le paiement pour l'intervention \"" + ctx.title() + "\" a ete rembourse",
                "/interventions/" + ctx.interventionId()
            );
        } catch (Exception e) {
            log.warn("Erreur notification PAYMENT_REFUND_COMPLETED: {}", e.getMessage());
        }
    }

    private void publishRefundDocumentEvent(PaymentStatusTransitionService.InterventionRefundContext ctx) {
        try {
            String emailTo = ctx.ownerEmail() != null ? ctx.ownerEmail() : "";
            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "justif-remboursement-int-" + ctx.interventionId(),
                Map.of(
                    "documentType", "JUSTIFICATIF_REMBOURSEMENT",
                    "referenceId", ctx.interventionId(),
                    "referenceType", "intervention",
                    "emailTo", emailTo
                )
            );
            log.debug("Evenement JUSTIFICATIF_REMBOURSEMENT publie sur Kafka pour l'intervention: {}", ctx.interventionId());
        } catch (Exception e) {
            log.error("Erreur publication Kafka JUSTIFICATIF_REMBOURSEMENT: {}", e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Service Request payment (nouveau workflow)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Cree une session de paiement Stripe pour une demande de service assignee.
     * Le demandeur paie le montant estimatedCost de la SR.
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createServiceRequestCheckoutSession(Long serviceRequestId, String customerEmail) throws StripeException {
        return createServiceRequestSession(serviceRequestId, customerEmail, false);
    }

    /**
     * Cree une session de paiement Stripe en mode EMBEDDED pour une demande de service.
     * Identique a createEmbeddedCheckoutSession mais pour les ServiceRequest.
     * Retourne une session avec clientSecret pour EmbeddedCheckout cote frontend.
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createServiceRequestEmbeddedCheckoutSession(Long serviceRequestId, String customerEmail) throws StripeException {
        return createServiceRequestSession(serviceRequestId, customerEmail, true);
    }

    /**
     * Variante unique HOSTED/EMBEDDED pour les demandes de service (T-SOLID-4).
     *
     * <p>La SR doit etre en AWAITING_PAYMENT (verifie par
     * {@link #loadPayableServiceRequest}) — son statut n'est donc pas modifie
     * ici, seuls le sessionId et le paymentStatus le sont. Le fallback herite
     * « V97 not applied » (T-BP-03) a ete supprime : la contrainte CHECK
     * incluant AWAITING_PAYMENT est en place de longue date (Liquibase), le
     * fallback ecrasait le statut avec PENDING en contradiction avec son propre
     * message, et son re-save s'executait dans une transaction deja marquee
     * rollback-only (inoperant).</p>
     */
    private Session createServiceRequestSession(Long serviceRequestId, String customerEmail,
                                                boolean embedded) throws StripeException {
        ServiceRequest sr = loadPayableServiceRequest(serviceRequestId);

        SessionCreateParams params = baseCheckoutParams(
                embedded,
                currency,
                StripeAmounts.toMinorUnits(sr.getEstimatedCost()),
                "Demande de service: " + sr.getTitle(),
                sr.getDescription() != null ? sr.getDescription() : "Paiement pour la demande de service",
                customerEmail)
            .putMetadata("type", "service_request")
            .putMetadata("service_request_id", serviceRequestId.toString())
            .build();

        Session session = stripeGateway.createSession(params);

        sr.setStripeSessionId(session.getId());
        sr.setPaymentStatus(PaymentStatus.PROCESSING);
        serviceRequestRepository.save(sr);

        log.info("Stripe {} session created for SR {}: sessionId={}",
            embedded ? "embedded" : "checkout", serviceRequestId, session.getId());

        return session;
    }

    /**
     * Charge une demande de service et valide qu'elle est payable :
     * statut AWAITING_PAYMENT (assignee, en attente de paiement) et montant
     * serveur strictement positif.
     */
    private ServiceRequest loadPayableServiceRequest(Long serviceRequestId) {
        ServiceRequest sr = serviceRequestRepository.findById(serviceRequestId)
            .orElseThrow(() -> new NotFoundException("Demande de service non trouvee: " + serviceRequestId));

        if (sr.getStatus() != RequestStatus.AWAITING_PAYMENT) {
            throw new IllegalStateException(
                "La demande de service doit etre en statut AWAITING_PAYMENT pour proceder au paiement. "
                + "Statut actuel: " + sr.getStatus());
        }

        BigDecimal amount = sr.getEstimatedCost();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Montant invalide pour la demande de service: " + amount);
        }
        return sr;
    }

    /**
     * Confirme le paiement d'une demande de service apres reception du webhook Stripe.
     * Met a jour la SR en PAID/IN_PROGRESS et cree automatiquement l'intervention.
     *
     * <p>Idempotent : early-return si deja PAID + transition gardee.</p>
     */
    public void confirmServiceRequestPayment(String sessionId) {
        ServiceRequest sr = serviceRequestRepository.findByStripeSessionId(sessionId)
            .orElseThrow(() -> new NotFoundException("Demande de service non trouvee pour la session: " + sessionId));

        if (sr.getPaymentStatus() == PaymentStatus.PAID) {
            log.info("Paiement SR deja confirme pour la session {} — traitement ignore (idempotence)", sessionId);
            return;
        }
        if (!paymentStatusTransitionService.markServiceRequestPaid(sr.getId())) {
            log.info("Confirmation concurrente detectee pour la SR {} — traitement ignore", sr.getId());
            return;
        }

        sr.setPaymentStatus(PaymentStatus.PAID);
        sr.setPaidAt(LocalDateTime.now());
        sr.setStatus(RequestStatus.IN_PROGRESS);
        serviceRequestRepository.save(sr);

        log.info("Paiement SR confirme: srId={}, sessionId={}", sr.getId(), sessionId);

        // ─── Wallet creation + ledger entry ──────────────────────────────────
        // Les sessions SR sont facturees dans la devise de config (cf. createServiceRequest*).
        Long srOwnerId = (sr.getUser() != null) ? sr.getUser().getId() : null;
        Long srPropertyId = (sr.getProperty() != null) ? sr.getProperty().getId() : null;
        ensureWalletsAndRecordPayment(
            sr.getOrganizationId(), srOwnerId, srPropertyId,
            sr.getEstimatedCost(),
            currency,
            "service-request", String.valueOf(sr.getId()),
            "Paiement demande de service: " + sr.getTitle()
        );

        // Creer l'intervention automatiquement
        try {
            serviceRequestService.createInterventionFromPaidServiceRequest(sr);
        } catch (Exception e) {
            log.error("Erreur creation intervention apres paiement SR {}: {}", sr.getId(), e.getMessage(), e);
        }

        // Notifications
        try {
            if (sr.getUser() != null && sr.getUser().getKeycloakId() != null) {
                notificationService.notify(
                    sr.getUser().getKeycloakId(),
                    NotificationKey.PAYMENT_CONFIRMED,
                    "Paiement confirme",
                    "Le paiement pour votre demande \"" + sr.getTitle() + "\" a ete confirme. L'intervention sera creee automatiquement.",
                    "/service-requests/" + sr.getId()
                );
            }
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYMENT_CONFIRMED,
                "Paiement SR confirme",
                "Le paiement pour la demande \"" + sr.getTitle() + "\" a ete confirme. Intervention creee.",
                "/service-requests/" + sr.getId()
            );
        } catch (Exception e) {
            log.warn("Erreur notification PAYMENT_CONFIRMED (SR): {}", e.getMessage());
        }
    }

    /**
     * Marque le paiement d'une demande de service comme echoue.
     */
    public void markServiceRequestPaymentFailed(String sessionId) {
        ServiceRequest sr = serviceRequestRepository.findByStripeSessionId(sessionId)
            .orElse(null);

        if (sr != null) {
            sr.setPaymentStatus(PaymentStatus.FAILED);
            // Revenir en AWAITING_PAYMENT pour que le demandeur puisse re-tenter le paiement
            sr.setStatus(RequestStatus.AWAITING_PAYMENT);
            serviceRequestRepository.save(sr);

            log.warn("Paiement SR echoue: srId={}, sessionId={}", sr.getId(), sessionId);

            try {
                if (sr.getUser() != null && sr.getUser().getKeycloakId() != null) {
                    notificationService.notify(
                        sr.getUser().getKeycloakId(),
                        NotificationKey.PAYMENT_FAILED,
                        "Echec du paiement",
                        "Le paiement pour votre demande \"" + sr.getTitle() + "\" a echoue. Vous pouvez reessayer.",
                        "/service-requests/" + sr.getId()
                    );
                }
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.PAYMENT_FAILED,
                    "Echec paiement SR",
                    "Le paiement pour la demande \"" + sr.getTitle() + "\" a echoue",
                    "/service-requests/" + sr.getId()
                );
            } catch (Exception e) {
                log.warn("Erreur notification PAYMENT_FAILED (SR): {}", e.getMessage());
            }
        }
    }
}
