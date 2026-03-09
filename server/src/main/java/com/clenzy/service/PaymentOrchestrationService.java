package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.*;
import com.clenzy.payment.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@Transactional
public class PaymentOrchestrationService {

    private static final Logger log = LoggerFactory.getLogger(PaymentOrchestrationService.class);

    private final PaymentProviderRegistry providerRegistry;
    private final PaymentMethodConfigService configService;
    private final PaymentTransactionRepository transactionRepository;
    private final OutboxPublisher outboxPublisher;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;

    public PaymentOrchestrationService(PaymentProviderRegistry providerRegistry,
                                        PaymentMethodConfigService configService,
                                        PaymentTransactionRepository transactionRepository,
                                        OutboxPublisher outboxPublisher,
                                        TenantContext tenantContext,
                                        ObjectMapper objectMapper) {
        this.providerRegistry = providerRegistry;
        this.configService = configService;
        this.transactionRepository = transactionRepository;
        this.outboxPublisher = outboxPublisher;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
    }

    /**
     * Initiates a payment through the best available provider.
     * Supports idempotency: if a transaction with the same idempotency key already exists,
     * it returns the existing result without creating a new transaction.
     */
    @CircuitBreaker(name = "payment-orchestrator", fallbackMethod = "initiatePaymentFallback")
    public PaymentOrchestrationResult initiatePayment(PaymentOrchestrationRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String countryCode = tenantContext.getCountryCode();

        // 1. Idempotency check — prevent duplicate transactions on client retry
        String idempotencyKey = request.idempotencyKey();
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<PaymentTransaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                PaymentTransaction existingTx = existing.get();
                if (existingTx.getStatus() == TransactionStatus.FAILED) {
                    // Allow retry on FAILED transactions — clear the old key so a new tx can be created
                    log.info("Previous transaction {} with key={} was FAILED, allowing retry",
                        existingTx.getTransactionRef(), idempotencyKey);
                    existingTx.setIdempotencyKey(null);
                    transactionRepository.save(existingTx);
                } else {
                    log.info("Idempotent request detected (key={}), returning existing transaction {}",
                        idempotencyKey, existingTx.getTransactionRef());
                    return new PaymentOrchestrationResult(existingTx,
                        PaymentResult.success(existingTx.getProviderTxId(), null),
                        existingTx.getProviderType());
                }
            }
        }

        // 2. Resolve provider
        PaymentProvider provider = resolveProvider(orgId, countryCode, request);
        log.info("Resolved payment provider: {} for org {} country {}",
            provider.getProviderType(), orgId, countryCode);

        // 3. Create transaction record with idempotency key
        PaymentTransaction tx = createTransaction(orgId, provider.getProviderType(), request, idempotencyKey);

        // 4. Build provider request
        Map<String, String> metadata = new HashMap<>();
        if (request.metadata() != null) metadata.putAll(request.metadata());
        metadata.put("orgId", String.valueOf(orgId));
        metadata.put("transactionRef", tx.getTransactionRef());
        if (request.sourceType() != null) metadata.put("sourceType", request.sourceType());
        if (request.sourceId() != null) metadata.put("sourceId", String.valueOf(request.sourceId()));

        PaymentRequest paymentRequest = new PaymentRequest(
            request.amount(), request.currency(),
            request.description(), request.customerEmail(), null,
            request.successUrl(), request.cancelUrl(),
            tx.getTransactionRef(), metadata
        );

        // 5. Call provider
        PaymentResult result;
        try {
            result = provider.createPayment(paymentRequest);
        } catch (Exception e) {
            log.error("Payment provider {} failed: {}", provider.getProviderType(), e.getMessage());
            tx.setStatus(TransactionStatus.FAILED);
            tx.setErrorMessage(e.getMessage());
            transactionRepository.save(tx);
            return new PaymentOrchestrationResult(tx,
                PaymentResult.failure(e.getMessage()), provider.getProviderType());
        }

        // 6. Update transaction
        if (result.success()) {
            tx.setProviderTxId(result.providerTxId());
            tx.setStatus(TransactionStatus.PROCESSING);
        } else {
            tx.setStatus(TransactionStatus.FAILED);
            tx.setErrorMessage(result.errorMessage());
        }
        tx = transactionRepository.save(tx);

        // 7. Publish event
        publishEvent(tx, "PAYMENT_INITIATED", orgId);

        return new PaymentOrchestrationResult(tx, result, provider.getProviderType());
    }

    @SuppressWarnings("unused")
    private PaymentOrchestrationResult initiatePaymentFallback(PaymentOrchestrationRequest request, Throwable t) {
        log.error("Payment orchestration circuit breaker open: {}", t.getMessage());
        return new PaymentOrchestrationResult(null,
            PaymentResult.failure("Service de paiement temporairement indisponible. Veuillez reessayer."),
            null);
    }

    /**
     * Process a refund for an existing transaction.
     */
    @CircuitBreaker(name = "payment-orchestrator", fallbackMethod = "processRefundFallback")
    public PaymentOrchestrationResult processRefund(String transactionRef,
                                                      BigDecimal amount, String reason) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        PaymentTransaction originalTx = transactionRepository.findByTransactionRef(transactionRef)
            .orElseThrow(() -> new RuntimeException("Transaction not found: " + transactionRef));

        if (!originalTx.getOrganizationId().equals(orgId)) {
            throw new RuntimeException("Transaction not found: " + transactionRef);
        }

        PaymentProvider provider = providerRegistry.get(originalTx.getProviderType());

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

        PaymentResult result;
        try {
            result = provider.refundPayment(originalTx.getProviderTxId(),
                amount != null ? amount : originalTx.getAmount(), reason);
        } catch (Exception e) {
            refundTx.setStatus(TransactionStatus.FAILED);
            refundTx.setErrorMessage(e.getMessage());
            transactionRepository.save(refundTx);
            return new PaymentOrchestrationResult(refundTx,
                PaymentResult.failure(e.getMessage()), provider.getProviderType());
        }

        if (result.success()) {
            refundTx.setProviderTxId(result.providerTxId());
            refundTx.setStatus(TransactionStatus.COMPLETED);
        } else {
            refundTx.setStatus(TransactionStatus.FAILED);
            refundTx.setErrorMessage(result.errorMessage());
        }
        refundTx = transactionRepository.save(refundTx);

        publishEvent(refundTx, "PAYMENT_REFUNDED", orgId);

        return new PaymentOrchestrationResult(refundTx, result, provider.getProviderType());
    }

    @SuppressWarnings("unused")
    private PaymentOrchestrationResult processRefundFallback(String transactionRef,
                                                               BigDecimal amount, String reason, Throwable t) {
        log.error("Refund circuit breaker open for {}: {}", transactionRef, t.getMessage());
        return new PaymentOrchestrationResult(null,
            PaymentResult.failure("Service de remboursement temporairement indisponible."), null);
    }

    /**
     * Mark a transaction as completed (called from webhook).
     * Idempotent: does nothing if already COMPLETED.
     */
    public PaymentTransaction completeTransaction(String transactionRef) {
        PaymentTransaction tx = transactionRepository.findByTransactionRef(transactionRef)
            .orElseThrow(() -> new RuntimeException("Transaction not found: " + transactionRef));

        if (tx.getStatus() == TransactionStatus.COMPLETED) {
            log.info("Transaction {} already completed, skipping", transactionRef);
            return tx;
        }

        tx.setStatus(TransactionStatus.COMPLETED);
        tx = transactionRepository.save(tx);
        publishEvent(tx, "PAYMENT_COMPLETED", tx.getOrganizationId());
        return tx;
    }

    /**
     * Mark a transaction as failed (called from webhook on failure).
     */
    public PaymentTransaction failTransaction(String transactionRef, String errorMessage) {
        PaymentTransaction tx = transactionRepository.findByTransactionRef(transactionRef)
            .orElseThrow(() -> new RuntimeException("Transaction not found: " + transactionRef));
        tx.setStatus(TransactionStatus.FAILED);
        tx.setErrorMessage(errorMessage);
        tx = transactionRepository.save(tx);
        publishEvent(tx, "PAYMENT_FAILED", tx.getOrganizationId());
        return tx;
    }

    private PaymentProvider resolveProvider(Long orgId, String countryCode,
                                             PaymentOrchestrationRequest request) {
        if (request.preferredProvider() != null) {
            return providerRegistry.get(request.preferredProvider());
        }

        List<PaymentMethodConfig> configs = configService.getEnabledProviders(orgId, countryCode);
        if (!configs.isEmpty()) {
            return providerRegistry.get(configs.get(0).getProviderType());
        }

        log.info("No enabled provider for org {} country {}, falling back to Stripe", orgId, countryCode);
        return providerRegistry.get(PaymentProviderType.STRIPE);
    }

    private PaymentTransaction createTransaction(Long orgId, PaymentProviderType providerType,
                                                   PaymentOrchestrationRequest request,
                                                   String idempotencyKey) {
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
