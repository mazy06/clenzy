package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutExecutorRegistry;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.payout.OwnerPayoutFundingService;
import com.clenzy.service.payout.PayoutTransferJournal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

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
 *
 * <h2>Transactions</h2>
 * <p>Ce service est volontairement NON transactionnel (règle audit n°2 — jamais
 * d'appel HTTP externe dans une transaction DB) : les executors font des appels
 * réseau (Stripe Transfer, Wise, GoCardless PIS) et persistent eux-mêmes chaque
 * transition de statut (PROCESSING puis PAID/FAILED) via le repository, chacune
 * dans sa propre transaction courte. Aucune connexion DB ni verrou n'est donc
 * tenu pendant le virement. Une transition conditionnelle réserve l'émission ;
 * le journal partagé protège les transferts Stripe au-delà de la durée de vie
 * des clés d'idempotence du PSP.</p>
 */
@Service
public class PayoutExecutionService {

    private static final Logger log = LoggerFactory.getLogger(PayoutExecutionService.class);
    private static final int MAX_RETRY_COUNT = 3;

    private final OwnerPayoutRepository payoutRepository;
    private final OwnerPayoutConfigRepository configRepository;
    private final PayoutExecutorRegistry executorRegistry;
    private final OwnerPayoutFundingService fundingService;
    private final PayoutTransferJournal transferJournal;

    public PayoutExecutionService(OwnerPayoutRepository payoutRepository,
                                   OwnerPayoutConfigRepository configRepository,
                                   PayoutExecutorRegistry executorRegistry,
                                   OwnerPayoutFundingService fundingService,
                                   PayoutTransferJournal transferJournal) {
        this.payoutRepository = payoutRepository;
        this.configRepository = configRepository;
        this.executorRegistry = executorRegistry;
        this.fundingService = fundingService;
        this.transferJournal = transferJournal;
    }

    /**
     * Exécute un payout en délégant à l'exécuteur correspondant à la méthode
     * configurée par le propriétaire. Seuls les payouts APPROVED peuvent être
     * exécutés, et la config doit être vérifiée.
     *
     * <p>HORS transaction : l'executor fait un appel HTTP externe et persiste
     * lui-même PROCESSING puis PAID/FAILED en transactions courtes (cf. javadoc
     * de classe).</p>
     */
    public OwnerPayout executePayout(Long payoutId, Long orgId) {
        OwnerPayout payout = payoutRepository.findByIdAndOrgId(payoutId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Payout not found: " + payoutId));

        if (payout.getStatus() != PayoutStatus.APPROVED) {
            throw new IllegalStateException(
                "Payout must be APPROVED before execution. Current: " + payout.getStatus());
        }
        fundingService.validate(payout);

        OwnerPayoutConfig config = configRepository.findByOwnerIdAndOrgId(payout.getOwnerId(), orgId)
            .orElseThrow(() -> new IllegalArgumentException(
                "Le proprietaire n'a pas encore configure sa methode de paiement. "
              + "Il doit connecter son compte de versement auprès du prestataire de paiement dans "
              + "Parametres > Mes reversements."));

        if (!config.isVerified()) {
            throw new IllegalArgumentException(
                "La configuration de paiement du proprietaire n'est pas encore verifiee.");
        }

        PayoutMethod method = config.getPayoutMethod() != null ? config.getPayoutMethod() : PayoutMethod.MANUAL;
        if (payout.getPayoutMethod() != null && payout.getPayoutMethod() != method) {
            throw new IllegalStateException("Le rail de ce reversement a déjà été fixé. Rapprochement requis avant changement.");
        }
        requirePspMethod(method);
        transferJournal.checkOwnerRoute(orgId, payoutId, method);
        log.info("Executing payout {} via {} for org {}", payoutId, method, orgId);

        PayoutExecutor executor;
        try {
            executor = executorRegistry.get(method);
        } catch (PayoutExecutor.PayoutExecutionException e) {
            throw new IllegalArgumentException(e.getMessage(), e);
        }

        try {
            executor.validate(payout, config);
        } catch (PayoutExecutor.PayoutExecutionException e) {
            throw new IllegalArgumentException(e.getMessage(), e);
        }
        if (payoutRepository.claimExecution(payoutId, orgId, method, PayoutStatus.APPROVED, PayoutStatus.PROCESSING) != 1) {
            throw new IllegalStateException("Ce reversement est déjà pris en charge ou son état a changé.");
        }
        payout.setStatus(PayoutStatus.PROCESSING);
        payout.setPayoutMethod(method);
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
     *
     * <p>HORS transaction, comme {@link #executePayout} : la remise à APPROVED
     * est commitée dans la transaction courte du {@code save}, puis l'exécution
     * (appel HTTP du provider) se fait sans transaction englobante. L'ancienne
     * auto-invocation {@code this.executePayout} sous {@code @Transactional}
     * contournait le proxy Spring (T-BP-06) ; sans annotation, l'appel direct
     * est désormais exactement le comportement voulu.</p>
     */
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
        fundingService.validate(payout);

        PayoutMethod method = configRepository.findByOwnerIdAndOrgId(payout.getOwnerId(), orgId)
                .map(OwnerPayoutConfig::getPayoutMethod).orElse(PayoutMethod.MANUAL);
        requirePspMethod(method);
        transferJournal.checkOwnerRoute(orgId, payoutId, method);
        if (payoutRepository.claimRetry(payoutId, orgId, PayoutStatus.FAILED, PayoutStatus.APPROVED) != 1) {
            throw new IllegalStateException("Ce reversement a déjà été relancé ou son état a changé.");
        }
        payout.setStatus(PayoutStatus.APPROVED);
        payout.setFailureReason(null);

        return executePayout(payoutId, orgId);
    }

    private void requirePspMethod(PayoutMethod method) {
        if (method == null || method == PayoutMethod.MANUAL || method == PayoutMethod.SEPA_TRANSFER) {
            throw new IllegalArgumentException(
                    "Les virements manuels et les exports SEPA sont désactivés. Connectez un compte de versement PSP.");
        }
    }
}
