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
            // Construit le contexte enrichi pour les providers régionaux (PayTabs,
            // Payzone) qui ont besoin de l'orgId + currency + transactionRef
            // pour reconstruire la requête refund auprès de la passerelle. Pour
            // Stripe, la default method de l'interface délègue à l'ancienne
            // signature (rétro-compat).
            var refundContext = new com.clenzy.payment.RefundContext(
                orgId,
                originalTx.getProviderTxId(),
                originalTx.getTransactionRef(),
                originalTx.getCurrency(),
                originalTx.getAmount());
            result = provider.refundPayment(refundContext,
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

    /**
     * Resout le provider a utiliser pour une transaction donnee.
     *
     * <h2>Ordre de priorite</h2>
     * <ol>
     *   <li><strong>preferredProvider</strong> : si l'appelant a explicitement
     *       impose un provider (ex: booking engine avec preference user),
     *       on l'utilise sans poser de question.</li>
     *   <li><strong>Currency match</strong> : pour une devise regionale forte
     *       (SAR → PayTabs, MAD → CMI/Payzone), on prefere un provider
     *       qui parle nativement cette devise SI il est active pour l'org.
     *       Evite les frais de conversion forex inutiles.</li>
     *   <li><strong>Country match</strong> : on retombe sur la liste des
     *       providers enabled pour le pays de l'org (logique pre-existante).</li>
     *   <li><strong>Fallback Stripe</strong> : derniere chance, accepte la
     *       plupart des devises avec frais raisonnables.</li>
     * </ol>
     *
     * <h2>Multi-currency par org</h2>
     * <p>Une org KSA peut accepter SAR (PayTabs) ET EUR (Stripe). Les deux
     * configs peuvent etre {@code enabled=true} en parallele — la devise de
     * la transaction tranche.</p>
     */
    private PaymentProvider resolveProvider(Long orgId, String countryCode,
                                             PaymentOrchestrationRequest request) {
        // 1. Preference explicite : court-circuit
        if (request.preferredProvider() != null) {
            return providerRegistry.get(request.preferredProvider());
        }

        List<PaymentMethodConfig> configs = configService.getEnabledProviders(orgId, countryCode);

        // 2. Currency match : pour les devises regionales fortes, on resout via
        //    la liste ordonnee des providers preferes (priorite decroissante)
        //    et on prend le premier enabled pour l'org. Plus efficient en
        //    frais Forex.
        List<PaymentProviderType> preferredOrder = preferredProvidersForCurrency(request.currency());
        for (PaymentProviderType preferred : preferredOrder) {
            for (PaymentMethodConfig cfg : configs) {
                if (cfg.getProviderType() == preferred) {
                    log.debug("Currency {} → {} (provider regional enabled pour org {})",
                        request.currency(), preferred, orgId);
                    return providerRegistry.get(preferred);
                }
            }
        }

        // 3. Country match : premier provider enabled pour le pays de l'org
        if (!configs.isEmpty()) {
            return providerRegistry.get(configs.get(0).getProviderType());
        }

        // 4. Fallback Stripe global
        log.info("No enabled provider for org {} country {}, falling back to Stripe",
            orgId, countryCode);
        return providerRegistry.get(PaymentProviderType.STRIPE);
    }

    /**
     * Mapping devise → liste ordonnee de providers regionaux preferes.
     *
     * <p>L'ordre exprime la preference : on essaie le premier, s'il n'est
     * pas enabled pour l'org on tente le suivant, etc. Pour les devises
     * multi-pays (EUR, USD, GBP), liste vide = pas de preference forte →
     * la logique pays-based prend le relais.</p>
     *
     * <h2>MAD (Maroc) : CMI > Payzone</h2>
     * <p>CMI reste le standard bancaire officiel (confiance, gros volumes).
     * Payzone est une alternative moderne (REST, onboarding rapide) — choisi
     * en fallback si CMI n'est pas configure pour l'org.</p>
     *
     * <h2>SAR (KSA) : PayTabs uniquement</h2>
     * <p>PayTabs est le leader regional, pas d'alternative crédible enabled
     * dans Clenzy pour l'instant.</p>
     *
     * <p>Visibilite package-private pour testabilite directe sans monter
     * tout le contexte Spring de l'orchestrateur.</p>
     */
    static List<PaymentProviderType> preferredProvidersForCurrency(String currency) {
        if (currency == null) return List.of();
        return switch (currency.toUpperCase()) {
            case "SAR" -> List.of(PaymentProviderType.PAYTABS);
            case "MAD" -> List.of(PaymentProviderType.CMI, PaymentProviderType.PAYZONE);
            // AED / EGP supportés par PayTabs aussi, mais on n'impose pas l'ordre
            // pour laisser le choix par-org. Ajouter ici si la règle se confirme
            // côté business.
            default -> List.of();
        };
    }

    /**
     * Ancienne signature pour rétro-compat avec les tests qui testent
     * la résolution single-provider. À retirer quand les tests seront
     * migrés vers la nouvelle signature.
     *
     * @deprecated utiliser {@link #preferredProvidersForCurrency(String)}
     */
    @Deprecated
    static PaymentProviderType preferredProviderForCurrency(String currency) {
        List<PaymentProviderType> list = preferredProvidersForCurrency(currency);
        return list.isEmpty() ? null : list.get(0);
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
