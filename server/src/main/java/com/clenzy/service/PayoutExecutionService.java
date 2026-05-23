package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutExecutorRegistry;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orchestrateur des executions de payouts.
 *
 * <h2>Pattern Strategy + Registry</h2>
 * <p>Délègue l'exécution à l'un des {@link PayoutExecutor} découverts par
 * Spring via {@link PayoutExecutorRegistry}. Cette classe ne contient plus de
 * logique provider-specific — l'ajout d'un nouveau rail (Wise, Open Banking,
 * Mangopay…) se fait via un nouveau bean executor, sans toucher ce service.</p>
 *
 * <h2>Responsabilités conservées</h2>
 * <ul>
 *   <li>Validation des invariants métier (payout en APPROVED, config verifiée)</li>
 *   <li>Gestion du compteur de retry (max 3)</li>
 *   <li>Resolution multi-tenant via {@code findByIdAndOrgId}</li>
 *   <li>Vérification de l'existence de la {@link OwnerPayoutConfig}</li>
 * </ul>
 */
@Service
public class PayoutExecutionService {

    private static final Logger log = LoggerFactory.getLogger(PayoutExecutionService.class);
    private static final int MAX_RETRY_COUNT = 3;

    private final OwnerPayoutRepository payoutRepository;
    private final OwnerPayoutConfigRepository configRepository;
    private final PayoutExecutorRegistry executorRegistry;

    public PayoutExecutionService(OwnerPayoutRepository payoutRepository,
                                   OwnerPayoutConfigRepository configRepository,
                                   PayoutExecutorRegistry executorRegistry) {
        this.payoutRepository = payoutRepository;
        this.configRepository = configRepository;
        this.executorRegistry = executorRegistry;
    }

    /**
     * Exécute un payout en délégant à l'exécuteur correspondant à la méthode
     * configurée par le propriétaire. Seuls les payouts APPROVED peuvent être
     * exécutés, et la config doit être vérifiée.
     */
    @Transactional
    public OwnerPayout executePayout(Long payoutId, Long orgId) {
        OwnerPayout payout = payoutRepository.findByIdAndOrgId(payoutId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Payout not found: " + payoutId));

        if (payout.getStatus() != PayoutStatus.APPROVED) {
            throw new IllegalStateException(
                "Payout must be APPROVED before execution. Current: " + payout.getStatus());
        }

        OwnerPayoutConfig config = configRepository.findByOwnerIdAndOrgId(payout.getOwnerId(), orgId)
            .orElseThrow(() -> new IllegalArgumentException(
                "Le proprietaire n'a pas encore configure sa methode de paiement. "
              + "Il doit renseigner son IBAN, connecter Stripe, Wise ou Open Banking dans "
              + "Parametres > Mes reversements."));

        if (!config.isVerified()) {
            throw new IllegalArgumentException(
                "La configuration de paiement du proprietaire n'est pas encore verifiee.");
        }

        PayoutMethod method = config.getPayoutMethod() != null ? config.getPayoutMethod() : PayoutMethod.MANUAL;
        log.info("Executing payout {} via {} for org {}", payoutId, method, orgId);

        PayoutExecutor executor;
        try {
            executor = executorRegistry.get(method);
        } catch (PayoutExecutor.PayoutExecutionException e) {
            throw new IllegalArgumentException(e.getMessage(), e);
        }

        try {
            return executor.execute(payout, config);
        } catch (PayoutExecutor.PayoutExecutionException e) {
            // L'executor a refusé l'exécution en amont (config invalide, méthode
            // non-automatisable, etc.) — on remonte tel quel à l'utilisateur.
            throw new IllegalArgumentException(e.getMessage(), e);
        }
    }

    /**
     * Relance un payout FAILED en remettant son statut à APPROVED.
     * Le compteur de retry est incrémenté ; au-delà de {@value #MAX_RETRY_COUNT}
     * relances, l'opération est refusée.
     */
    @Transactional
    public OwnerPayout retryPayout(Long payoutId, Long orgId) {
        OwnerPayout payout = payoutRepository.findByIdAndOrgId(payoutId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Payout not found: " + payoutId));

        if (payout.getStatus() != PayoutStatus.FAILED) {
            throw new IllegalStateException(
                "Only FAILED payouts can be retried. Current: " + payout.getStatus());
        }

        if (payout.getRetryCount() >= MAX_RETRY_COUNT) {
            throw new IllegalStateException(
                "Max retry count (" + MAX_RETRY_COUNT + ") reached for payout " + payoutId);
        }

        payout.setStatus(PayoutStatus.APPROVED);
        payout.setFailureReason(null);
        payoutRepository.save(payout);

        return executePayout(payoutId, orgId);
    }
}
