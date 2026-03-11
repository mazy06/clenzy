package com.clenzy.service;

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
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

import java.math.BigDecimal;
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
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final TenantContext tenantContext;

    @Value("${stripe.secret-key}")
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
                         KafkaTemplate<String, Object> kafkaTemplate,
                         TenantContext tenantContext) {
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.notificationService = notificationService;
        this.serviceRequestService = serviceRequestService;
        this.walletService = walletService;
        this.ledgerService = ledgerService;
        this.splitPaymentService = splitPaymentService;
        this.kafkaTemplate = kafkaTemplate;
        this.tenantContext = tenantContext;
    }
    
    /**
     * Crée une session de paiement Stripe pour une intervention
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createCheckoutSession(Long interventionId, BigDecimal amount, String customerEmail) throws StripeException {
        // Initialiser Stripe avec la clé secrète
        Stripe.apiKey = stripeSecretKey;
        
        // Récupérer l'intervention
        Intervention intervention = interventionRepository.findById(interventionId)
            .orElseThrow(() -> new RuntimeException("Intervention non trouvée: " + interventionId));
        
        // Convertir le montant en centimes (Stripe utilise les centimes)
        long amountInCents = amount.multiply(BigDecimal.valueOf(100)).longValue();
        
        // Créer les paramètres de la session
        SessionCreateParams params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setSuccessUrl(successUrl)
            .setCancelUrl(cancelUrl)
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(currency.toLowerCase())
                            .setUnitAmount(amountInCents)
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName("Intervention: " + intervention.getTitle())
                                    .setDescription(intervention.getDescription() != null ? 
                                        intervention.getDescription() : "Paiement pour l'intervention")
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .setCustomerEmail(customerEmail)
            .putMetadata("intervention_id", interventionId.toString())
            .build();
        
        // Créer la session
        Session session = Session.create(params);
        
        // Sauvegarder l'ID de la session dans l'intervention
        intervention.setStripeSessionId(session.getId());
        intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        interventionRepository.save(intervention);
        
        return session;
    }

    /**
     * Cree une session de paiement Stripe en mode EMBEDDED (inline dans l'interface).
     * Retourne une session avec un clientSecret utilisable cote frontend
     * via EmbeddedCheckoutProvider de @stripe/react-stripe-js.
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createEmbeddedCheckoutSession(Long interventionId, BigDecimal amount, String customerEmail) throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        Intervention intervention = interventionRepository.findById(interventionId)
            .orElseThrow(() -> new RuntimeException("Intervention non trouvee: " + interventionId));

        long amountInCents = amount.multiply(BigDecimal.valueOf(100)).longValue();

        SessionCreateParams params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setUiMode(SessionCreateParams.UiMode.EMBEDDED)
            // Never redirect — onComplete callback in the embedded modal handles confirmation
            .setRedirectOnCompletion(SessionCreateParams.RedirectOnCompletion.NEVER)
            // Only card payments — no iDEAL/Klarna/Bancontact that open external tabs
            .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(currency.toLowerCase())
                            .setUnitAmount(amountInCents)
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName("Intervention: " + intervention.getTitle())
                                    .setDescription(intervention.getDescription() != null ?
                                        intervention.getDescription() : "Paiement pour l'intervention")
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .setCustomerEmail(customerEmail)
            .putMetadata("intervention_id", interventionId.toString())
            .build();

        Session session = Session.create(params);

        intervention.setStripeSessionId(session.getId());
        intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        interventionRepository.save(intervention);

        return session;
    }

    /**
     * Crée une session de paiement Stripe pour une réservation (envoi par email au guest).
     * Ne modifie pas la réservation (c'est le controller qui le fait).
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createReservationCheckoutSession(Long reservationId, BigDecimal amount,
                                                     String customerEmail, String guestName,
                                                     String propertyName) throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        long amountInCents = amount.multiply(BigDecimal.valueOf(100)).longValue();

        SessionCreateParams params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setSuccessUrl(successUrl)
            .setCancelUrl(cancelUrl)
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(currency.toLowerCase())
                            .setUnitAmount(amountInCents)
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName("Reservation: " + propertyName)
                                    .setDescription("Paiement pour la reservation de "
                                            + (guestName != null ? guestName : "guest"))
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .setCustomerEmail(customerEmail)
            .putMetadata("reservation_id", reservationId.toString())
            .putMetadata("type", "reservation")
            .build();

        return Session.create(params);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Wallet creation on payment confirmation
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Ensures wallets exist for the organization and records the payment in the ledger.
     * Creates PLATFORM wallet (org-level) and OWNER wallet (property owner) if they don't exist.
     * Then records a ledger entry: ESCROW → PLATFORM for the payment amount.
     *
     * @param orgId       Organization ID
     * @param ownerId     Property owner user ID (nullable)
     * @param amount      Payment amount
     * @param refType     Reference type for the ledger
     * @param refId       Reference ID (e.g., "intervention-123")
     * @param description Human-readable description
     */
    private void ensureWalletsAndRecordPayment(Long orgId, Long ownerId, Long propertyId,
                                                BigDecimal amount,
                                                String refType, String refId, String description) {
        try {
            String curr = (currency != null && !currency.isBlank()) ? currency.toUpperCase() : "EUR";

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

            log.info("Wallets ensured and payment recorded for org={}, ref={}, amount={}", orgId, refId, amount);

            // ─── Split revenue: PLATFORM → OWNER + CONCIERGE ─────────────────
            // propertyId is used to detect if a concierge (ManagementContract) is involved.
            // If no concierge, the concierge share is redirected to the owner.
            if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
                try {
                    splitPaymentService.splitGenericPayment(amount, curr, ownerId, propertyId, refType, refId);
                } catch (Exception splitEx) {
                    log.error("Split failed for ref={}, payment still confirmed: {}", refId, splitEx.getMessage(), splitEx);
                }
            }
        } catch (Exception e) {
            // Wallet/ledger errors should not block the payment confirmation flow
            log.error("Error ensuring wallets/recording payment for ref={}: {}", refId, e.getMessage(), e);
        }
    }

    /**
     * Overload for reservation payments: uses splitPayment() with reservationId
     * for ManagementContract-aware split ratios.
     */
    private void ensureWalletsAndRecordPaymentForReservation(Long orgId, Long ownerId, BigDecimal amount,
                                                               Long reservationId, String refId, String description) {
        try {
            String curr = (currency != null && !currency.isBlank()) ? currency.toUpperCase() : "EUR";

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

            log.info("Wallets ensured and payment recorded for reservation org={}, ref={}, amount={}", orgId, refId, amount);

            // Split with reservation context (ManagementContract → SplitConfig → defaults)
            if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
                try {
                    splitPaymentService.splitPayment(reservationId, amount, curr, ownerId);
                } catch (Exception splitEx) {
                    log.error("Split failed for reservation {}, payment still confirmed: {}",
                        reservationId, splitEx.getMessage(), splitEx);
                }
            }
        } catch (Exception e) {
            log.error("Error ensuring wallets/recording payment for reservation ref={}: {}", refId, e.getMessage(), e);
        }
    }

    /**
     * Confirme le paiement d'une intervention après réception du webhook
     */
    public void confirmPayment(String sessionId) {
        // Use the no-orgId variant because this is called from the Stripe webhook (no tenant context)
        Intervention intervention = interventionRepository.findByStripeSessionId(sessionId)
            .orElseThrow(() -> new RuntimeException("Intervention non trouvée pour la session: " + sessionId));

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

        // ─── Génération automatique FACTURE + JUSTIFICATIF_PAIEMENT ──────────
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
     */
    public void confirmReservationPayment(String sessionId) {
        Reservation reservation = reservationRepository.findByStripeSessionId(sessionId)
            .orElseThrow(() -> new RuntimeException("Reservation non trouvee pour la session: " + sessionId));

        reservation.setPaymentStatus(PaymentStatus.PAID);
        reservation.setPaidAt(LocalDateTime.now());
        reservationRepository.save(reservation);

        log.info("Paiement de reservation confirme: reservationId={}, sessionId={}", reservation.getId(), sessionId);

        // ─── Wallet creation + ledger entry + split (ManagementContract-aware) ──
        Long ownerId = (reservation.getProperty() != null && reservation.getProperty().getOwner() != null)
                ? reservation.getProperty().getOwner().getId() : null;
        ensureWalletsAndRecordPaymentForReservation(
            reservation.getOrganizationId(), ownerId,
            reservation.getTotalPrice(),
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
     * Chaque intervention incluse passe en PAID.
     */
    public void confirmGroupedPayment(String sessionId, String interventionIds) {
        if (interventionIds == null || interventionIds.isBlank()) return;

        String[] ids = interventionIds.split(",");
        for (String idStr : ids) {
            try {
                Long id = Long.parseLong(idStr.trim());
                Intervention intervention = interventionRepository.findById(id).orElse(null);
                if (intervention != null) {
                    intervention.setPaymentStatus(PaymentStatus.PAID);
                    intervention.setPaidAt(LocalDateTime.now());
                    intervention.setStripeSessionId(sessionId);
                    interventionRepository.save(intervention);

                    // ─── Wallet creation + ledger entry ──────────────────────
                    Long ownerId = (intervention.getProperty() != null && intervention.getProperty().getOwner() != null)
                            ? intervention.getProperty().getOwner().getId() : null;
                    Long propId = (intervention.getProperty() != null) ? intervention.getProperty().getId() : null;
                    ensureWalletsAndRecordPayment(
                        intervention.getOrganizationId(), ownerId, propId,
                        intervention.getEstimatedCost(),
                        "intervention", String.valueOf(intervention.getId()),
                        "Paiement intervention (groupe): " + intervention.getTitle()
                    );

                    // ─── Génération automatique FACTURE + JUSTIFICATIF_PAIEMENT ──
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
                        log.debug("Evenements FACTURE + JUSTIFICATIF_PAIEMENT publies (groupe) pour l'intervention: {}", intervention.getId());
                    } catch (Exception e) {
                        log.error("Erreur publication Kafka FACTURE/JUSTIFICATIF (groupe): {}", e.getMessage());
                    }
                }
            } catch (NumberFormatException e) {
                // Ignorer les IDs invalides
            }
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
                // Ignorer les IDs invalides
            }
        }
    }

    /**
     * Rembourse un paiement via Stripe et met a jour le statut de l'intervention.
     */
    @CircuitBreaker(name = "stripe-api")
    public void refundPayment(Long interventionId) throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        Intervention intervention = interventionRepository.findById(interventionId)
            .orElseThrow(() -> new RuntimeException("Intervention non trouvee: " + interventionId));

        if (intervention.getPaymentStatus() != PaymentStatus.PAID) {
            throw new RuntimeException("Seuls les paiements confirmes peuvent etre rembourses. Statut actuel: " + intervention.getPaymentStatus());
        }

        // Recuperer le PaymentIntent depuis la session Stripe
        String sessionId = intervention.getStripeSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            throw new RuntimeException("Aucune session Stripe associee a cette intervention");
        }

        Session session = Session.retrieve(sessionId);
        String paymentIntentId = session.getPaymentIntent();
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new RuntimeException("Aucun PaymentIntent trouve pour la session: " + sessionId);
        }

        // Creer le remboursement Stripe (remboursement total)
        RefundCreateParams refundParams = RefundCreateParams.builder()
            .setPaymentIntent(paymentIntentId)
            .build();
        Refund.create(refundParams);

        // Mettre a jour le statut
        intervention.setPaymentStatus(PaymentStatus.REFUNDED);
        interventionRepository.save(intervention);

        // Notifications
        try {
            if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    && intervention.getProperty().getOwner().getKeycloakId() != null) {
                notificationService.notify(
                    intervention.getProperty().getOwner().getKeycloakId(),
                    NotificationKey.PAYMENT_REFUND_COMPLETED,
                    "Remboursement effectue",
                    "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a ete rembourse",
                    "/interventions/" + intervention.getId()
                );
            }
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYMENT_REFUND_COMPLETED,
                "Remboursement effectue",
                "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a ete rembourse",
                "/interventions/" + intervention.getId()
            );
        } catch (Exception e) {
            log.warn("Erreur notification PAYMENT_REFUND_COMPLETED: {}", e.getMessage());
        }

        // ─── Génération automatique JUSTIFICATIF_REMBOURSEMENT ───────────────
        try {
            String emailTo = (intervention.getProperty() != null && intervention.getProperty().getOwner() != null)
                    ? intervention.getProperty().getOwner().getEmail() : "";

            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "justif-remboursement-int-" + intervention.getId(),
                Map.of(
                    "documentType", "JUSTIFICATIF_REMBOURSEMENT",
                    "referenceId", intervention.getId(),
                    "referenceType", "intervention",
                    "emailTo", emailTo != null ? emailTo : ""
                )
            );
            log.debug("Evenement JUSTIFICATIF_REMBOURSEMENT publie sur Kafka pour l'intervention: {}", intervention.getId());
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
        Stripe.apiKey = stripeSecretKey;

        ServiceRequest sr = serviceRequestRepository.findById(serviceRequestId)
            .orElseThrow(() -> new RuntimeException("Demande de service non trouvee: " + serviceRequestId));

        // La SR doit etre en AWAITING_PAYMENT (assignee, en attente de paiement)
        if (sr.getStatus() != RequestStatus.AWAITING_PAYMENT) {
            throw new RuntimeException("La demande de service doit etre en statut AWAITING_PAYMENT pour proceder au paiement. Statut actuel: " + sr.getStatus());
        }

        BigDecimal amount = sr.getEstimatedCost();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Montant invalide pour la demande de service: " + amount);
        }

        long amountInCents = amount.multiply(BigDecimal.valueOf(100)).longValue();

        SessionCreateParams params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setSuccessUrl(successUrl)
            .setCancelUrl(cancelUrl)
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(currency.toLowerCase())
                            .setUnitAmount(amountInCents)
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName("Demande de service: " + sr.getTitle())
                                    .setDescription(sr.getDescription() != null ?
                                        sr.getDescription() : "Paiement pour la demande de service")
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .setCustomerEmail(customerEmail)
            .putMetadata("type", "service_request")
            .putMetadata("service_request_id", serviceRequestId.toString())
            .build();

        Session session = Session.create(params);

        sr.setStripeSessionId(session.getId());
        sr.setPaymentStatus(PaymentStatus.PROCESSING);
        try {
            sr.setStatus(RequestStatus.AWAITING_PAYMENT);
            serviceRequestRepository.save(sr);
        } catch (Exception e) {
            // Fallback: si la CHECK constraint ne contient pas encore AWAITING_PAYMENT (V97 pas appliquee),
            // on garde le statut actuel mais on sauvegarde quand meme le sessionId et paymentStatus
            log.warn("Could not set AWAITING_PAYMENT for SR {} (V97 not applied?): {} — saving with current status",
                    serviceRequestId, e.getMessage());
            sr.setStatus(RequestStatus.PENDING);
            serviceRequestRepository.save(sr);
        }

        log.info("Stripe checkout session created for SR {}: sessionId={}", serviceRequestId, session.getId());

        return session;
    }

    /**
     * Cree une session de paiement Stripe en mode EMBEDDED pour une demande de service.
     * Identique a createEmbeddedCheckoutSession mais pour les ServiceRequest.
     * Retourne une session avec clientSecret pour EmbeddedCheckout cote frontend.
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createServiceRequestEmbeddedCheckoutSession(Long serviceRequestId, String customerEmail) throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        ServiceRequest sr = serviceRequestRepository.findById(serviceRequestId)
            .orElseThrow(() -> new RuntimeException("Demande de service non trouvee: " + serviceRequestId));

        BigDecimal amount = sr.getEstimatedCost();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Montant invalide pour la demande de service: " + amount);
        }

        long amountInCents = amount.multiply(BigDecimal.valueOf(100)).longValue();

        SessionCreateParams params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setUiMode(SessionCreateParams.UiMode.EMBEDDED)
            .setRedirectOnCompletion(SessionCreateParams.RedirectOnCompletion.NEVER)
            .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(currency.toLowerCase())
                            .setUnitAmount(amountInCents)
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName("Demande de service: " + sr.getTitle())
                                    .setDescription(sr.getDescription() != null ?
                                        sr.getDescription() : "Paiement pour la demande de service")
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .setCustomerEmail(customerEmail)
            .putMetadata("type", "service_request")
            .putMetadata("service_request_id", serviceRequestId.toString())
            .build();

        Session session = Session.create(params);

        sr.setStripeSessionId(session.getId());
        sr.setPaymentStatus(PaymentStatus.PROCESSING);
        try {
            sr.setStatus(RequestStatus.AWAITING_PAYMENT);
            serviceRequestRepository.save(sr);
        } catch (Exception e) {
            log.warn("Could not set AWAITING_PAYMENT for SR {} (embedded): {} — saving with current status",
                    serviceRequestId, e.getMessage());
            sr.setStatus(RequestStatus.PENDING);
            serviceRequestRepository.save(sr);
        }

        log.info("Stripe embedded session created for SR {}: sessionId={}", serviceRequestId, session.getId());

        return session;
    }

    /**
     * Confirme le paiement d'une demande de service apres reception du webhook Stripe.
     * Met a jour la SR en PAID/IN_PROGRESS et cree automatiquement l'intervention.
     */
    public void confirmServiceRequestPayment(String sessionId) {
        ServiceRequest sr = serviceRequestRepository.findByStripeSessionId(sessionId)
            .orElseThrow(() -> new RuntimeException("Demande de service non trouvee pour la session: " + sessionId));

        sr.setPaymentStatus(PaymentStatus.PAID);
        sr.setPaidAt(LocalDateTime.now());
        sr.setStatus(RequestStatus.IN_PROGRESS);
        serviceRequestRepository.save(sr);

        log.info("Paiement SR confirme: srId={}, sessionId={}", sr.getId(), sessionId);

        // ─── Wallet creation + ledger entry ──────────────────────────────────
        Long srOwnerId = (sr.getUser() != null) ? sr.getUser().getId() : null;
        Long srPropertyId = (sr.getProperty() != null) ? sr.getProperty().getId() : null;
        ensureWalletsAndRecordPayment(
            sr.getOrganizationId(), srOwnerId, srPropertyId,
            sr.getEstimatedCost(),
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
