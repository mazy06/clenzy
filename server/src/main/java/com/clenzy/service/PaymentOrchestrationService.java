package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.PaymentCapability;
import com.clenzy.payment.PaymentProvider;
import com.clenzy.payment.PaymentProviderRegistry;
import com.clenzy.payment.PaymentRequest;
import com.clenzy.payment.PaymentResult;
import com.clenzy.payment.RefundContext;
import com.clenzy.tenant.TenantContext;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Orchestre les paiements entrants (checkout, refund) à travers le meilleur
 * provider disponible.
 *
 * <h2>Frontières transactionnelles (ADR paiement multi-provider, Vague 1b)</h2>
 * <p>Ce service <strong>n'est pas transactionnel</strong> : il résout le
 * provider et effectue l'appel externe (HTTP) <em>hors de toute transaction
 * DB</em>. Toutes les écritures passent par {@link PaymentPersistence}, dont
 * chaque méthode ouvre une transaction courte — respectant la règle
 * « jamais d'appel HTTP externe dans une transaction DB ».</p>
 */
@Service
public class PaymentOrchestrationService {

    private static final Logger log = LoggerFactory.getLogger(PaymentOrchestrationService.class);

    private final PaymentProviderRegistry providerRegistry;
    private final PaymentMethodConfigService configService;
    private final PaymentPersistence paymentPersistence;
    private final TenantContext tenantContext;

    public PaymentOrchestrationService(PaymentProviderRegistry providerRegistry,
                                        PaymentMethodConfigService configService,
                                        PaymentPersistence paymentPersistence,
                                        TenantContext tenantContext) {
        this.providerRegistry = providerRegistry;
        this.configService = configService;
        this.paymentPersistence = paymentPersistence;
        this.tenantContext = tenantContext;
    }

    /**
     * Initie un paiement via le meilleur provider disponible.
     *
     * <p>Séquence : idempotence (tx courte) → résolution du provider → persist
     * PENDING (tx courte) → <strong>appel provider hors transaction</strong> →
     * persist résultat + outbox (tx courte, atomique).</p>
     */
    @CircuitBreaker(name = "payment-orchestrator", fallbackMethod = "initiatePaymentFallback")
    public PaymentOrchestrationResult initiatePayment(PaymentOrchestrationRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String countryCode = tenantContext.getCountryCode();

        // 1. Idempotence — court-circuit si une transaction non-FAILED existe déjà
        Optional<PaymentTransaction> replay = paymentPersistence.consumeIdempotentReplay(request.idempotencyKey());
        if (replay.isPresent()) {
            PaymentTransaction existingTx = replay.get();
            log.info("Idempotent request detected (key={}), returning existing transaction {}",
                request.idempotencyKey(), existingTx.getTransactionRef());
            return new PaymentOrchestrationResult(existingTx,
                PaymentResult.success(existingTx.getProviderTxId(), null), existingTx.getProviderType());
        }

        // 2. Résolution du provider (local — pas d'appel externe)
        PaymentProvider provider = resolveProvider(orgId, countryCode, request);
        log.info("Resolved payment provider: {} for org {} country {}",
            provider.getProviderType(), orgId, countryCode);

        // 3. Persist PENDING (transaction courte — committée avant l'appel externe)
        PaymentTransaction tx = paymentPersistence.createPending(
            orgId, provider.getProviderType(), request, request.idempotencyKey());

        // 4. Construit la requête provider
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

        // 5. Appel provider — HORS de toute transaction DB
        PaymentResult result;
        try {
            result = provider.createPayment(paymentRequest);
        } catch (Exception e) {
            log.error("Payment provider {} failed: {}", provider.getProviderType(), e.getMessage());
            PaymentTransaction failed = paymentPersistence.markInitiationFailed(
                tx.getTransactionRef(), e.getMessage());
            return new PaymentOrchestrationResult(failed,
                PaymentResult.failure(e.getMessage()), provider.getProviderType());
        }

        // 6. Persist résultat + outbox (transaction courte, atomique)
        PaymentTransaction finalTx = paymentPersistence.finalizeInitiation(
            tx.getTransactionRef(), result, orgId);
        return new PaymentOrchestrationResult(finalTx, result, provider.getProviderType());
    }

    @SuppressWarnings("unused")
    private PaymentOrchestrationResult initiatePaymentFallback(PaymentOrchestrationRequest request, Throwable t) {
        log.error("Payment orchestration circuit breaker open: {}", t.getMessage());
        return new PaymentOrchestrationResult(null,
            PaymentResult.failure("Service de paiement temporairement indisponible. Veuillez reessayer."),
            null);
    }

    /**
     * Traite un remboursement pour une transaction existante.
     *
     * <p>Séquence : validation ownership + persist refund PROCESSING (tx courte)
     * → <strong>appel refund hors transaction</strong> → persist résultat +
     * outbox (tx courte).</p>
     */
    @CircuitBreaker(name = "payment-orchestrator", fallbackMethod = "processRefundFallback")
    public PaymentOrchestrationResult processRefund(String transactionRef,
                                                      BigDecimal amount, String reason) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        // 1. Ownership + création de la transaction de remboursement (tx courte)
        PaymentPersistence.RefundInit init = paymentPersistence.createRefundPending(orgId, transactionRef, amount);
        PaymentProvider provider = providerRegistry.get(init.providerType());

        // 2. Appel refund — HORS transaction. Contexte enrichi pour les providers
        //    régionaux (PayTabs, Payzone) ; Stripe délègue à la signature historique.
        PaymentResult result;
        try {
            var refundContext = new RefundContext(orgId, init.originalProviderTxId(),
                init.originalTransactionRef(), init.currency(), init.originalAmount());
            result = provider.refundPayment(refundContext,
                amount != null ? amount : init.originalAmount(), reason);
        } catch (Exception e) {
            PaymentTransaction failed = paymentPersistence.markRefundFailed(
                init.refundTransactionRef(), e.getMessage());
            return new PaymentOrchestrationResult(failed,
                PaymentResult.failure(e.getMessage()), init.providerType());
        }

        // 3. Persist résultat + outbox (tx courte)
        PaymentTransaction refundTx = paymentPersistence.finalizeRefund(
            init.refundTransactionRef(), result, orgId);
        return new PaymentOrchestrationResult(refundTx, result, init.providerType());
    }

    @SuppressWarnings("unused")
    private PaymentOrchestrationResult processRefundFallback(String transactionRef,
                                                               BigDecimal amount, String reason, Throwable t) {
        log.error("Refund circuit breaker open for {}: {}", transactionRef, t.getMessage());
        return new PaymentOrchestrationResult(null,
            PaymentResult.failure("Service de remboursement temporairement indisponible."), null);
    }

    /** Marque une transaction COMPLETED (appelé depuis un webhook). Idempotent. */
    public PaymentTransaction completeTransaction(String transactionRef) {
        return paymentPersistence.completeTransaction(transactionRef);
    }

    /** Marque une transaction FAILED (appelé depuis un webhook d'échec). */
    public PaymentTransaction failTransaction(String transactionRef, String errorMessage) {
        return paymentPersistence.failTransaction(transactionRef, errorMessage);
    }

    /**
     * Résout le provider à utiliser pour une transaction donnée.
     *
     * <h2>Ordre de priorité</h2>
     * <ol>
     *   <li><strong>preferredProvider</strong> : préférence explicite de l'appelant.</li>
     *   <li><strong>Currency match</strong> : devise régionale forte (SAR → PayTabs,
     *       MAD → CMI/Payzone) si le provider est activé pour l'org.</li>
     *   <li><strong>Country match</strong> : premier provider activé pour le pays.</li>
     *   <li><strong>Fallback Stripe</strong>.</li>
     * </ol>
     *
     * <p>Une org peut avoir plusieurs providers {@code enabled=true} en
     * parallèle (ex. SAR via PayTabs ET EUR via Stripe) — la devise tranche.</p>
     */
    private PaymentProvider resolveProvider(Long orgId, String countryCode,
                                             PaymentOrchestrationRequest request) {
        // Flux createPayment standard : capacité de base PAY (pas de filtrage).
        return resolveProvider(orgId, countryCode, request, Set.of(PaymentCapability.PAY));
    }

    /**
     * Résout le provider en tenant compte des <strong>capacités requises</strong>
     * par le flux appelant.
     *
     * <p>{@link PaymentCapability#PAY} étant la base de tout provider, le
     * filtrage capacitaire ne s'active que pour les capacités différenciantes
     * (PREAUTH pour une caution, PAYOUT, CUSTOMER…). Le flux paiement standard
     * conserve donc exactement la résolution historique (preferred → devise →
     * pays → fallback Stripe).</p>
     */
    private PaymentProvider resolveProvider(Long orgId, String countryCode,
                                             PaymentOrchestrationRequest request,
                                             Set<PaymentCapability> required) {
        // 1. Preference explicite : court-circuit
        if (request.preferredProvider() != null) {
            return providerRegistry.get(request.preferredProvider());
        }

        List<PaymentMethodConfig> configs = configService.getEnabledProviders(orgId, countryCode);
        boolean filterCapabilities = required.stream().anyMatch(c -> c != PaymentCapability.PAY);

        // 2. Currency match : provider régional préféré, s'il est activé ET capable
        List<PaymentProviderType> preferredOrder = preferredProvidersForCurrency(request.currency());
        for (PaymentProviderType preferred : preferredOrder) {
            for (PaymentMethodConfig cfg : configs) {
                if (cfg.getProviderType() == preferred
                        && isCapable(preferred, required, filterCapabilities)) {
                    log.debug("Currency {} → {} (provider regional enabled pour org {})",
                        request.currency(), preferred, orgId);
                    return providerRegistry.get(preferred);
                }
            }
        }

        // 3. Country match : premier provider enabled ET capable pour le pays de l'org
        for (PaymentMethodConfig cfg : configs) {
            if (isCapable(cfg.getProviderType(), required, filterCapabilities)) {
                return providerRegistry.get(cfg.getProviderType());
            }
        }

        // 4. Fallback Stripe global (couvre toutes les capacités)
        log.info("No enabled capable provider for org {} country {}, falling back to Stripe",
            orgId, countryCode);
        return providerRegistry.get(PaymentProviderType.STRIPE);
    }

    /**
     * Un provider est utilisable si le filtrage est inactif (flux PAY de base)
     * ou s'il déclare toutes les capacités requises.
     */
    private boolean isCapable(PaymentProviderType type, Set<PaymentCapability> required,
                               boolean filterCapabilities) {
        if (!filterCapabilities) {
            return true;
        }
        PaymentProvider provider = providerRegistry.get(type);
        return required.stream().allMatch(provider::supports);
    }

    /**
     * Mapping devise → liste ordonnée de providers régionaux préférés.
     *
     * <p>MAD (Maroc) : CMI &gt; Payzone. SAR (KSA) : PayTabs. Devises multi-pays
     * (EUR, USD, GBP) : liste vide → logique pays-based.</p>
     */
    static List<PaymentProviderType> preferredProvidersForCurrency(String currency) {
        if (currency == null) return List.of();
        return switch (currency.toUpperCase()) {
            case "SAR" -> List.of(PaymentProviderType.PAYTABS);
            case "MAD" -> List.of(PaymentProviderType.CMI, PaymentProviderType.PAYZONE);
            default -> List.of();
        };
    }

    /**
     * @deprecated utiliser {@link #preferredProvidersForCurrency(String)}
     */
    @Deprecated
    static PaymentProviderType preferredProviderForCurrency(String currency) {
        List<PaymentProviderType> list = preferredProvidersForCurrency(currency);
        return list.isEmpty() ? null : list.get(0);
    }
}
