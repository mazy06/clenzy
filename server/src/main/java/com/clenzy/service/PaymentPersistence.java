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

    public PaymentPersistence(PaymentTransactionRepository transactionRepository,
                              OutboxPublisher outboxPublisher,
                              ObjectMapper objectMapper) {
        this.transactionRepository = transactionRepository;
        this.outboxPublisher = outboxPublisher;
        this.objectMapper = objectMapper;
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
        return transactionRepository.save(tx);
    }

    /** Persiste le résultat de l'appel provider (PROCESSING/FAILED) + publie l'outbox, de façon atomique. */
    @Transactional
    public PaymentTransaction finalizeInitiation(String transactionRef, PaymentResult result, Long orgId) {
        PaymentTransaction tx = requireTx(transactionRef);
        if (result.success()) {
            tx.setProviderTxId(result.providerTxId());
            tx.setStatus(TransactionStatus.PROCESSING);
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
                             String currency, BigDecimal originalAmount) {}

    /** Valide l'ownership de la transaction d'origine et crée la transaction de remboursement {@code PROCESSING}. */
    @Transactional
    public RefundInit createRefundPending(Long orgId, String originalTransactionRef, BigDecimal amount) {
        PaymentTransaction originalTx = requireTx(originalTransactionRef);
        if (!originalTx.getOrganizationId().equals(orgId)) {
            throw new RuntimeException("Transaction not found: " + originalTransactionRef);
        }
        PaymentTransaction refundTx = new PaymentTransaction();
        refundTx.setOrganizationId(orgId);
        refundTx.setTransactionRef("REF-" + UUID.randomUUID().toString().substring(0, 8));
        refundTx.setProviderType(originalTx.getProviderType());
        refundTx.setPaymentType(TransactionType.REFUND);
        refundTx.setStatus(TransactionStatus.PROCESSING);
        refundTx.setAmount(amount != null ? amount : originalTx.getAmount());
        refundTx.setCurrency(originalTx.getCurrency());
        refundTx.setSourceType(originalTx.getSourceType());
        refundTx.setSourceId(originalTx.getSourceId());
        refundTx = transactionRepository.save(refundTx);
        return new RefundInit(refundTx.getTransactionRef(), originalTx.getProviderType(),
            originalTx.getProviderTxId(), originalTx.getTransactionRef(),
            originalTx.getCurrency(), originalTx.getAmount());
    }

    /** Persiste le résultat du remboursement (COMPLETED/FAILED) + publie l'outbox, de façon atomique. */
    @Transactional
    public PaymentTransaction finalizeRefund(String refundTransactionRef, PaymentResult result, Long orgId) {
        PaymentTransaction refundTx = requireTx(refundTransactionRef);
        if (result.success()) {
            refundTx.setProviderTxId(result.providerTxId());
            refundTx.setStatus(TransactionStatus.COMPLETED);
        } else {
            refundTx.setStatus(TransactionStatus.FAILED);
            refundTx.setErrorMessage(result.errorMessage());
        }
        refundTx = transactionRepository.save(refundTx);
        publishEvent(refundTx, "PAYMENT_REFUNDED", orgId);
        return refundTx;
    }

    /** Marque le remboursement FAILED après une exception de l'appel provider (pas d'outbox). */
    @Transactional
    public PaymentTransaction markRefundFailed(String refundTransactionRef, String errorMessage) {
        PaymentTransaction refundTx = requireTx(refundTransactionRef);
        refundTx.setStatus(TransactionStatus.FAILED);
        refundTx.setErrorMessage(errorMessage);
        return transactionRepository.save(refundTx);
    }

    // ─── Webhooks (pas d'appel externe : simple mise à jour d'état + outbox) ────

    /** Marque la transaction COMPLETED (idempotent : ne fait rien si déjà COMPLETED). */
    @Transactional
    public PaymentTransaction completeTransaction(String transactionRef) {
        PaymentTransaction tx = requireTx(transactionRef);
        if (tx.getStatus() == TransactionStatus.COMPLETED) {
            log.info("Transaction {} already completed, skipping", transactionRef);
            return tx;
        }
        tx.setStatus(TransactionStatus.COMPLETED);
        tx = transactionRepository.save(tx);
        publishEvent(tx, "PAYMENT_COMPLETED", tx.getOrganizationId());
        return tx;
    }

    /** Marque la transaction FAILED (appelé depuis un webhook d'échec). */
    @Transactional
    public PaymentTransaction failTransaction(String transactionRef, String errorMessage) {
        PaymentTransaction tx = requireTx(transactionRef);
        tx.setStatus(TransactionStatus.FAILED);
        tx.setErrorMessage(errorMessage);
        tx = transactionRepository.save(tx);
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
            String payload = objectMapper.writeValueAsString(Map.of(
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
