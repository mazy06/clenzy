package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.model.TransactionStatus;
import com.clenzy.model.TransactionType;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.PaymentTransactionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistance transactionnelle des paiements — extraite de
 * {@code PaymentOrchestrationService} (ADR paiement multi-provider, Vague 1b).
 *
 * <h2>Pourquoi ce bean séparé</h2>
 * <p>L'orchestrateur doit appeler un provider externe (HTTP Stripe / PSP)
 * <strong>hors de toute transaction DB</strong> (règle CLAUDE.md : jamais
 * d'appel HTTP externe dans une transaction). Le pattern est donc :
 * <em>transaction courte (persist PENDING) → appel externe hors tx → nouvelle
 * transaction (persist résultat + outbox, atomique)</em>.</p>
 *
 * <p>Chaque méthode publique porte sa propre {@link Transactional} : appelées
 * depuis un autre bean (l'orchestrateur), elles passent bien par le proxy
 * Spring et ouvrent de vraies frontières transactionnelles courtes.</p>
 */
@Service
public class PaymentPersistence {

    private static final Logger log = LoggerFactory.getLogger(PaymentPersistence.class);

    private final PaymentTransactionRepository transactionRepository;
    private final OutboxPublisher outboxPublisher;
    private final ObjectMapper objectMapper;
    private final DepositReconciler depositReconciler;
    private final InterventionPaymentCoordination interventionPayments;
    private final InvoicePaymentCoordination invoicePayments;
    private final com.clenzy.service.payout.BaitlyTransferRecoveryStore transferRecoveries;

    public PaymentPersistence(PaymentTransactionRepository transactionRepository,
                              OutboxPublisher outboxPublisher,
                              ObjectMapper objectMapper,
                              DepositReconciler depositReconciler,
                              InterventionPaymentCoordination interventionPayments, InvoicePaymentCoordination invoicePayments,
                              com.clenzy.service.payout.BaitlyTransferRecoveryStore transferRecoveries) {
        this.transactionRepository = transactionRepository;
        this.outboxPublisher = outboxPublisher;
        this.objectMapper = objectMapper;
        this.depositReconciler = depositReconciler;
        this.interventionPayments = interventionPayments;
        this.invoicePayments = invoicePayments;
        this.transferRecoveries = transferRecoveries;
    }

    // ─── Initiation ───────────────────────────────────────────────────────────

    /**
     * Consomme une éventuelle transaction idempotente pré-existante.
     *
     * @return la transaction existante si elle n'est pas FAILED (replay) ;
     *         {@link Optional#empty()} si la clé est absente/vide, inconnue,
     *         ou si la transaction précédente était FAILED (la clé est alors
     *         libérée pour autoriser un nouvel essai).
     */
    @Transactional
    public Optional<PaymentTransaction> consumeIdempotentReplay(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return Optional.empty();
        }
        Optional<PaymentTransaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        PaymentTransaction tx = existing.get();
        if (tx.getStatus() == TransactionStatus.FAILED) {
            if ("INTERVENTION".equals(tx.getSourceType()) && !BaitlyInterventionCheckoutExpiryWriter.retryProven(tx))
                return Optional.of(tx); // Une erreur réseau seule ne prouve jamais l'absence d'encaissement.
            if (ServiceRequestPaymentService.SOURCE_TYPE.equals(tx.getSourceType())
                    || InvoicePaymentCoordination.SOURCE_TYPE.equals(tx.getSourceType())
                    || InvoicePaymentCoordination.invoiceId(tx.getMetadata()) != null
                       && !Boolean.TRUE.equals(tx.getMetadata().get("batchRetryAllowed"))
                       && !BaitlyInterventionCheckoutExpiryWriter.retryProven(tx)) {
                // L'échec local ne prouve pas l'absence d'encaissement de la demande.
                // Conserver la tentative pour rapprochement, même après conversion en mission.
                return Optional.of(tx);
            }
            if (InterventionPaymentBatch.SOURCE_TYPE.equals(tx.getSourceType())
                    && (tx.getMetadata() == null || !Boolean.TRUE.equals(tx.getMetadata().get("batchRetryAllowed")))) {
                // Une erreur réseau ne prouve pas qu'aucune session n'a été créée chez Stripe.
                return Optional.of(tx);
            }
            log.info("Previous transaction {} with key={} was FAILED, allowing retry",
                tx.getTransactionRef(), idempotencyKey);
            tx.setIdempotencyKey(null);
            transactionRepository.save(tx);
            return Optional.empty();
        }
        return Optional.of(tx);
    }

    /** Crée et persiste une transaction {@code PENDING} (transaction courte, committée avant l'appel externe). */
    @Transactional
    public PaymentTransaction createPending(Long orgId, PaymentProviderType providerType,
                                            PaymentOrchestrationRequest request, String idempotencyKey) {
        var allocations = interventionPayments.lockPaymentMissions(orgId, request);
        invoicePayments.lockForPayment(orgId, request);
        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrganizationId(orgId);
        tx.setTransactionRef("TX-" + UUID.randomUUID().toString().substring(0, 12));
        tx.setProviderType(providerType);
        tx.setPaymentType(TransactionType.CHECKOUT);
        tx.setStatus(TransactionStatus.PENDING);
        tx.setAmount(request.amount());
        tx.setCurrency(request.currency());
        tx.setSourceType(request.sourceType());
        tx.setSourceId(request.sourceId());
        tx.setIdempotencyKey(idempotencyKey);
        if (request.metadata() != null) {
            tx.setMetadata(new HashMap<>(request.metadata()));
        }
        tx = transactionRepository.save(tx);
        interventionPayments.recordBatchAllocations(tx, allocations);
        invoicePayments.bindPrepared(tx);
        return tx;
    }

    /** Persiste le résultat de l'appel provider (PROCESSING/FAILED) + publie l'outbox, de façon atomique. */
    @Transactional
    public PaymentTransaction finalizeInitiation(String transactionRef, PaymentResult result, Long orgId) {
        PaymentTransaction tx = requireTx(transactionRef);
        if (result.success()) {
            tx.setProviderTxId(result.providerTxId());
            tx.setStatus(TransactionStatus.PROCESSING);
            interventionPayments.attachBatchSession(tx);
            invoicePayments.attachReservation(tx);
        } else {
            tx.setStatus(TransactionStatus.FAILED);
            tx.setErrorMessage(result.errorMessage());
        }
        tx = transactionRepository.save(tx);
        publishEvent(tx, "PAYMENT_INITIATED", orgId);
        return tx;
    }

    /** Marque la transaction FAILED après une exception de l'appel provider (pas d'outbox). */
    @Transactional
    public PaymentTransaction markInitiationFailed(String transactionRef, String errorMessage) {
        PaymentTransaction tx = requireTx(transactionRef);
        tx.setStatus(TransactionStatus.FAILED);
        tx.setErrorMessage(errorMessage);
        return transactionRepository.save(tx);
    }

    // ─── Remboursement ─────────────────────────────────────────────────────────

    /** Contexte minimal renvoyé au flux refund pour l'appel externe (hors tx). */
    public record RefundInit(String refundTransactionRef, PaymentProviderType providerType,
                             String originalProviderTxId, String originalTransactionRef,
                             String currency, BigDecimal originalAmount, BigDecimal refundAmount,
                             TransactionStatus status, String providerRefundId, java.time.LocalDateTime requestedAt) {}

    /** Valide l'ownership de la transaction d'origine et crée la transaction de remboursement {@code PROCESSING}. */
    @Transactional
    public RefundInit createRefundPending(Long orgId, String originalTransactionRef, BigDecimal amount) {
        PaymentTransaction originalTx = transactionRepository.lockByReference(orgId, originalTransactionRef)
            .orElseThrow(() -> new IllegalStateException("Transaction not found: " + originalTransactionRef));
        if (!originalTx.getOrganizationId().equals(orgId)) {
            throw new RuntimeException("Transaction not found: " + originalTransactionRef);
        }
        if (InterventionPaymentBatch.SOURCE_TYPE.equals(originalTx.getSourceType())) {
            throw new IllegalStateException("Un paiement groupé doit être remboursé par allocation ; ce parcours n'est pas encore disponible.");
        }
        if (InvoicePaymentCoordination.SOURCE_TYPE.equals(originalTx.getSourceType())) {
            throw new IllegalStateException("Le remboursement de facture nécessite un avoir et un rapprochement dédiés.");
        }
        if (originalTx.getPaymentType() != TransactionType.CHECKOUT || originalTx.getStatus() != TransactionStatus.COMPLETED
                || originalTx.getProviderTxId() == null || originalTx.getAmount() == null || originalTx.getAmount().signum() <= 0) {
            throw new IllegalStateException("Un encaissement confirmé est nécessaire au remboursement.");
        }
        if (originalTx.hasDisputeRisk()) throw new com.clenzy.exception.PaymentValidationException(
                "Un litige bancaire concerne ce paiement. Rapprochez son issue avant de rembourser.");
        BigDecimal requested = amount == null ? originalTx.getAmount() : amount;
        if (requested.signum() <= 0 || requested.compareTo(originalTx.getAmount()) > 0) {
            throw new IllegalArgumentException("Montant de remboursement hors du montant encaissé.");
        }
        // Les contre-écritures actuelles concernent une mission entière. Ne pas émettre
        // de restitution partielle avant son allocation et son avoir dédiés.
        if (!"INTERVENTION".equals(originalTx.getSourceType()) || requested.compareTo(originalTx.getAmount()) != 0) {
            throw new IllegalStateException("Ce remboursement exige une répartition et un rapprochement dédiés.");
        }
        var previous = transactionRepository.findByOrganizationIdAndSourceTypeAndSourceId(
                orgId, originalTx.getSourceType(), originalTx.getSourceId()).stream()
            .filter(t -> t.getPaymentType() == TransactionType.REFUND && t.getMetadata() != null
                && originalTransactionRef.equals(t.getMetadata().get("originalTransactionRef"))).toList();
        if (!previous.isEmpty()) {
            if (previous.size() != 1 || previous.get(0).getAmount().compareTo(requested) != 0) {
                throw new com.clenzy.exception.PaymentValidationException(
                    "Un remboursement existe déjà pour ce paiement. Vérifiez le montant remboursé et son rapprochement avant toute nouvelle demande.");
            }
            var existing = previous.get(0);
            if (existing.getStatus() != TransactionStatus.COMPLETED && !managedRefund(existing)) {
                throw new com.clenzy.exception.PaymentValidationException(
                    "Un remboursement est déjà en cours ou à rapprocher. Aucun nouveau remboursement n'a été envoyé.");
            }
            return refundInit(existing, originalTx);
        }
        interventionPayments.requireStandaloneRefund(originalTx);
        PaymentTransaction refundTx = new PaymentTransaction();
        refundTx.setOrganizationId(orgId);
        refundTx.setTransactionRef("REF-" + UUID.randomUUID());
        refundTx.setProviderType(originalTx.getProviderType());
        refundTx.setPaymentType(TransactionType.REFUND);
        refundTx.setStatus(TransactionStatus.PROCESSING);
        refundTx.setAmount(requested);
        refundTx.setCurrency(originalTx.getCurrency());
        refundTx.setSourceType(originalTx.getSourceType());
        refundTx.setSourceId(originalTx.getSourceId());
        refundTx.setMetadata(java.util.Map.of("originalTransactionRef", originalTransactionRef,
                "managedRefund", originalTx.getProviderType() == PaymentProviderType.STRIPE));
        refundTx.setIdempotencyKey("REFUND-" + orgId + "-" + originalTx.getId());
        refundTx = transactionRepository.save(refundTx);
        transferRecoveries.prepareFullInterventionRefund(refundTx, originalTx.getAmount());
        return refundInit(refundTx, originalTx);
    }

    private RefundInit refundInit(PaymentTransaction refund, PaymentTransaction original) {
        return new RefundInit(refund.getTransactionRef(), original.getProviderType(), original.getProviderTxId(),
                original.getTransactionRef(), original.getCurrency(), original.getAmount(), refund.getAmount(),
                refund.getStatus(), refund.getProviderTxId(), refund.getCreatedAt());
    }

    public static boolean managedRefund(PaymentTransaction tx) {
        return tx.getPaymentType() == TransactionType.REFUND && tx.getMetadata() != null
                && Boolean.TRUE.equals(tx.getMetadata().get("managedRefund"));
    }

    /** Persiste la preuve du remboursement ; seul un succès confirmé publie l'outbox. */
    @Transactional
    public PaymentTransaction finalizeRefund(String refundTransactionRef, PaymentResult result, Long orgId) {
        PaymentTransaction refundTx = transactionRepository.lockByReference(orgId, refundTransactionRef).orElseThrow();
        if (refundTx.getPaymentType() != TransactionType.REFUND) throw new IllegalStateException("Remboursement introuvable");
        if (refundTx.getStatus() == TransactionStatus.COMPLETED) return refundTx;
        if (!result.success() && refundTx.getStatus() == TransactionStatus.FAILED
                && !"REFUND_REJECTED".equals(result.status())) return refundTx;
        if (result.providerTxId() != null) {
            if (refundTx.getProviderTxId() != null && !refundTx.getProviderTxId().equals(result.providerTxId())) {
                throw new IllegalStateException("Preuve d'un autre remboursement");
            }
            refundTx.setProviderTxId(result.providerTxId());
        }
        if (result.success()) {
            if (managedRefund(refundTx) && (result.providerTxId() == null || !"REFUNDED".equals(result.status()))) {
                throw new IllegalStateException("Remboursement non confirmé par le PSP");
            }
            refundTx.setStatus(TransactionStatus.COMPLETED);
            refundTx.setErrorMessage(null);
        } else {
            // Un timeout ou pending ne libère jamais le montant réservé au remboursement.
            refundTx.setStatus(managedRefund(refundTx) && !"REFUND_REJECTED".equals(result.status())
                    ? TransactionStatus.PROCESSING : TransactionStatus.FAILED);
            refundTx.setErrorMessage(result.errorMessage());
        }
        refundTx = transactionRepository.save(refundTx);
        if (refundTx.getStatus() == TransactionStatus.COMPLETED) publishEvent(refundTx, "PAYMENT_REFUNDED", orgId);
        return refundTx;
    }

    /** Conserve la décision Stripe ambiguë en traitement, sans événement de succès. */
    @Transactional
    public PaymentTransaction markRefundFailed(String refundTransactionRef, String errorMessage) {
        var located = requireTx(refundTransactionRef);
        PaymentTransaction refundTx = transactionRepository.lockByReference(located.getOrganizationId(), refundTransactionRef).orElseThrow();
        if (refundTx.getStatus() == TransactionStatus.COMPLETED || refundTx.getStatus() == TransactionStatus.FAILED) return refundTx;
        refundTx.setStatus(managedRefund(refundTx) ? TransactionStatus.PROCESSING : TransactionStatus.FAILED);
        refundTx.setErrorMessage(errorMessage);
        return transactionRepository.save(refundTx);
    }

    // ─── Webhooks (pas d'appel externe : simple mise à jour d'état + outbox) ────

    /**
     * Marque la transaction COMPLETED, par UPDATE conditionnel (audit 2026-07, P6-05).
     *
     * <p>Idempotent <b>et</b> concurrent-safe : seul l'appel qui gagne le compare-and-set
     * publie l'evenement. Les rejeux — Kafka at-least-once, re-livraison de webhook,
     * redemarrage — obtiennent 0 ligne modifiee et ne republient rien.</p>
     */
    @Transactional
    public PaymentTransaction completeTransaction(String transactionRef) {
        int updated = transactionRepository.markCompleted(transactionRef);
        PaymentTransaction tx = requireTx(transactionRef);
        // La preuve et son affectation au devis sont atomiques ; un rejeu répare aussi un ancien rattachement absent.
        if(tx.getStatus()==TransactionStatus.COMPLETED)depositReconciler.onPaymentCompleted(tx);
        if (updated == 0) {
            log.info("Transaction {} already completed, skipping", transactionRef);
            return tx;
        }
        publishEvent(tx, "PAYMENT_COMPLETED", tx.getOrganizationId());
        return tx;
    }

    /**
     * Marque la transaction FAILED (appelé depuis un webhook d'échec), <b>sans jamais
     * dégrader</b> une transaction déjà encaissée (audit 2026-07, P6-12).
     *
     * <p>Un webhook d'échec rejoué après un succès laisse la transaction COMPLETED et ne
     * publie aucun PAYMENT_FAILED : le ledger reste cohérent avec l'entité métier.</p>
     */
    @Transactional
    public PaymentTransaction failTransaction(String transactionRef, String errorMessage) {
        int updated = transactionRepository.markFailed(transactionRef, errorMessage);
        PaymentTransaction tx = requireTx(transactionRef);
        if (updated == 0) {
            log.warn("Transaction {} en statut {} : echec ignore (transition refusee) — {}",
                    transactionRef, tx.getStatus(), errorMessage);
            return tx;
        }
        publishEvent(tx, "PAYMENT_FAILED", tx.getOrganizationId());
        return tx;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private PaymentTransaction requireTx(String transactionRef) {
        return transactionRepository.findByTransactionRef(transactionRef)
            .orElseThrow(() -> new RuntimeException("Transaction not found: " + transactionRef));
    }

    private void publishEvent(PaymentTransaction tx, String eventType, Long orgId) {
        try {
            // eventType DOIT figurer dans le payload : l'OutboxRelay ne publie QUE le
            // payload sur Kafka (pas l'eventType de la ligne outbox). Sans ce champ, le
            // PaymentEventConsumer (qui dispatche sur event.get("eventType")) ne routerait
            // jamais PAYMENT_COMPLETED → aucune réconciliation d'entité (Vague 2).
            String payload = objectMapper.writeValueAsString(Map.of(
                "eventType", eventType,
                "transactionRef", tx.getTransactionRef(),
                "providerType", tx.getProviderType().name(),
                "status", tx.getStatus().name(),
                "amount", tx.getAmount().toPlainString(),
                "currency", tx.getCurrency(),
                "sourceType", tx.getSourceType() != null ? tx.getSourceType() : "",
                "sourceId", tx.getSourceId() != null ? tx.getSourceId() : 0
            ));
            outboxPublisher.publish("PAYMENT", tx.getTransactionRef(),
                eventType, KafkaConfig.TOPIC_PAYMENT_EVENTS,
                tx.getTransactionRef(), payload, orgId);
        } catch (JsonProcessingException e) {
            log.error("Failed to publish payment event: {}", e.getMessage());
        }
    }
}
