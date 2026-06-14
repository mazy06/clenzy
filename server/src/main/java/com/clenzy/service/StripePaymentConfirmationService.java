package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
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
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.email.BookingConfirmationEmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Confirmations idempotentes des paiements Stripe (webhooks + fallbacks) et
 * marquage des echecs — extrait de {@link StripeService} (G1).
 *
 * <p>L'idempotence repose sur le couple early-return (statut deja PAID) +
 * transition gardee {@link PaymentStatusTransitionService} (UPDATE conditionnel,
 * Z3-BUGS-01 / Z3-SEC-02). Les methodes s'executent dans le contexte
 * transactionnel de l'appelant ({@code StripeService}) : comportement
 * strictement identique a l'implementation historique.</p>
 */
@Service
public class StripePaymentConfirmationService {

    private static final Logger log = LoggerFactory.getLogger(StripePaymentConfirmationService.class);

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
    private final PaymentStatusTransitionService paymentStatusTransitionService;
    private final BookingConfirmationEmailService bookingConfirmationEmailService;
    private final WebhookEventPublisher webhookEventPublisher;

    @Value("${stripe.currency}")
    private String currency;

    public StripePaymentConfirmationService(InterventionRepository interventionRepository,
                                            ReservationRepository reservationRepository,
                                            ServiceRequestRepository serviceRequestRepository,
                                            NotificationService notificationService,
                                            ServiceRequestService serviceRequestService,
                                            WalletService walletService,
                                            LedgerService ledgerService,
                                            SplitPaymentService splitPaymentService,
                                            AutoInvoiceService autoInvoiceService,
                                            KafkaTemplate<String, Object> kafkaTemplate,
                                            PaymentStatusTransitionService paymentStatusTransitionService,
                                            BookingConfirmationEmailService bookingConfirmationEmailService,
                                            WebhookEventPublisher webhookEventPublisher) {
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
        this.paymentStatusTransitionService = paymentStatusTransitionService;
        this.bookingConfirmationEmailService = bookingConfirmationEmailService;
        this.webhookEventPublisher = webhookEventPublisher;
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
                "/interventions/" + intervention.getId()
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

        // Webhook sortant PAYMENT_CONFIRMED : enfile dans la transaction, livraison HTTP apres commit (#2).
        java.util.Map<String, Object> webhookData = new java.util.HashMap<>();
        webhookData.put("reservationId", reservation.getId());
        webhookData.put("status", reservation.getStatus());
        webhookData.put("paymentStatus", reservation.getPaymentStatus() != null ? reservation.getPaymentStatus().name() : null);
        webhookData.put("totalPrice", reservation.getTotalPrice());
        webhookData.put("propertyId", reservation.getProperty() != null ? reservation.getProperty().getId() : null);
        webhookEventPublisher.publish(com.clenzy.model.WebhookEventType.PAYMENT_CONFIRMED,
                reservation.getOrganizationId(), webhookData);

        // Email de confirmation guest APRES COMMIT (audit #2 : aucun appel externe dans la
        // transaction). Best-effort : un echec d'envoi n'impacte pas la confirmation de
        // paiement. Idempotent via l'early-return PAID en tete de methode.
        final Long confirmedReservationId = reservation.getId();
        runAfterCommit(() -> {
            try {
                bookingConfirmationEmailService.sendForReservation(confirmedReservationId);
            } catch (Exception e) {
                log.warn("Email de confirmation non envoye pour la reservation {}: {}",
                        confirmedReservationId, e.getMessage());
            }
        });

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
                "/reservations?highlight=" + reservation.getId()
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
     * Execute une action APRES le commit de la transaction courante (effets externes
     * hors transaction, audit #2). Hors contexte transactionnel (tests), execute
     * immediatement.
     */
    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
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
                    "/reservations?highlight=" + reservation.getId()
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
                    "/interventions?tab=service-requests&highlight=" + sr.getId()
                );
            }
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYMENT_CONFIRMED,
                "Paiement SR confirme",
                "Le paiement pour la demande \"" + sr.getTitle() + "\" a ete confirme. Intervention creee.",
                "/interventions?tab=service-requests&highlight=" + sr.getId()
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
                        "/interventions?tab=service-requests&highlight=" + sr.getId()
                    );
                }
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.PAYMENT_FAILED,
                    "Echec paiement SR",
                    "Le paiement pour la demande \"" + sr.getTitle() + "\" a echoue",
                    "/interventions?tab=service-requests&highlight=" + sr.getId()
                );
            } catch (Exception e) {
                log.warn("Erreur notification PAYMENT_FAILED (SR): {}", e.getMessage());
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Wallet creation on payment confirmation
    // ════════════════════════════════════════════════════════════════════════

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
                "/billing?tab=wallets"
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
}
