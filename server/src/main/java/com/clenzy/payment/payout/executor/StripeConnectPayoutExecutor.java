package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.StripeGateway;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.repository.OwnerPayoutRepository;
import com.stripe.model.Transfer;
import com.stripe.param.TransferCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

/**
 * Exécuteur Stripe Connect : transfert automatique vers le compte connecté
 * du propriétaire. Couverture EU + US + UK + ~40 pays.
 *
 * <p>Le propriétaire doit avoir complété l'onboarding Stripe Connect (Express)
 * et la config doit contenir un {@code stripeConnectedAccountId} valide.</p>
 *
 * <h2>Anti double-virement (Z3-BUGS-03)</h2>
 * <ul>
 *   <li>Le transfert est émis avec une idempotency key Stripe dérivée du payout
 *       ({@code payout-<id>}) : un re-essai après échec post-transfert renvoie
 *       le même transfert, jamais un second virement.</li>
 *   <li>Seul l'échec de {@code Transfer.create} marque le payout FAILED. Un
 *       échec de persistance APRÈS un transfert réussi n'est PAS traité comme
 *       un échec de virement : il déclenche une ALERTE de réconciliation
 *       structurée vers les admins/managers (en plus du log ERROR) et est
 *       remonté sans passer par {@code failPayout} (pas d'incrément de retry
 *       FAILED). Un humain est ainsi notifié de l'incohérence transfert-réussi
 *       / DB-non-persistée.</li>
 *   <li>Un échec de notification ne fait jamais échouer l'exécution.</li>
 * </ul>
 */
@Component
public class StripeConnectPayoutExecutor implements PayoutExecutor {

    private static final Logger log = LoggerFactory.getLogger(StripeConnectPayoutExecutor.class);

    private final StripeGateway stripeGateway;
    private final OwnerPayoutRepository payoutRepository;
    private final PayoutNotifier notifier;

    public StripeConnectPayoutExecutor(StripeGateway stripeGateway,
                                        OwnerPayoutRepository payoutRepository,
                                        PayoutNotifier notifier) {
        this.stripeGateway = stripeGateway;
        this.payoutRepository = payoutRepository;
        this.notifier = notifier;
    }

    @Override
    public PayoutMethod getSupportedMethod() {
        return PayoutMethod.STRIPE_CONNECT;
    }

    @Override
    public OwnerPayout execute(OwnerPayout payout, OwnerPayoutConfig config) {
        if (config.getStripeConnectedAccountId() == null || config.getStripeConnectedAccountId().isBlank()) {
            throw new PayoutExecutionException(
                "Stripe Connect : compte connecte manquant pour le proprietaire.");
        }

        payout.setStatus(PayoutStatus.PROCESSING);
        payout.setPayoutMethod(PayoutMethod.STRIPE_CONNECT);
        payoutRepository.save(payout);

        // Le try est restreint au transfert lui-meme : seul un echec du virement
        // doit conduire a FAILED (retryable).
        Transfer transfer;
        try {
            transfer = stripeGateway.createTransfer(
                buildTransferParams(payout, config),
                "payout-" + payout.getId());
        } catch (Exception e) {
            return failPayout(payout, e.getMessage());
        }

        OwnerPayout saved = persistTransferResult(payout, transfer);
        notifySuccessQuietly(saved);
        log.info("Stripe transfer {} completed for payout {}", transfer.getId(), payout.getId());
        return saved;
    }

    private TransferCreateParams buildTransferParams(OwnerPayout payout, OwnerPayoutConfig config) {
        long amountInCents = payout.getNetAmount()
            .multiply(BigDecimal.valueOf(100))
            .setScale(0, RoundingMode.HALF_UP)
            .longValueExact();

        String description = "Payout #" + payout.getId()
            + " - " + payout.getPeriodStart() + " to " + payout.getPeriodEnd();

        return TransferCreateParams.builder()
            .setAmount(amountInCents)
            .setCurrency(payout.getCurrency().toLowerCase())
            .setDestination(config.getStripeConnectedAccountId())
            .setDescription(description)
            .build();
    }

    /**
     * Persiste le resultat du transfert. Un echec ici ne doit PAS marquer le
     * payout FAILED (l'argent est parti) : log ERROR + ALERTE de reconciliation
     * structuree vers les admins/managers (un humain doit reconcilier, pas
     * seulement un log — regle audit n°7) puis propagation d'une exception
     * explicite — le re-essai est sans risque grace a l'idempotency key Stripe.
     */
    private OwnerPayout persistTransferResult(OwnerPayout payout, Transfer transfer) {
        try {
            payout.setStripeTransferId(transfer.getId());
            payout.setPaymentReference(transfer.getId());
            payout.setStatus(PayoutStatus.PAID);
            payout.setPaidAt(Instant.now());
            return payoutRepository.save(payout);
        } catch (Exception e) {
            log.error("Transfert Stripe {} emis pour le payout {} mais la persistance a echoue — "
                + "reconciliation requise (re-executer ce payout est sans risque : idempotency key payout-{}).",
                transfer.getId(), payout.getId(), payout.getId(), e);
            notifyReconciliationQuietly(payout, transfer.getId());
            throw new PayoutExecutionException(
                "Le virement Stripe a ete emis (ref " + transfer.getId()
                + ") mais son enregistrement a echoue. Ne pas re-executer via un autre rail — "
                + "relancer ce payout est sans risque (idempotence Stripe).", e);
        }
    }

    /**
     * Alerte de reconciliation best-effort : un echec de notification ne doit
     * jamais masquer l'incident de persistance d'origine (qui est propage).
     */
    private void notifyReconciliationQuietly(OwnerPayout payout, String transferReference) {
        try {
            notifier.notifyReconciliationRequired(payout, transferReference);
        } catch (Exception e) {
            log.warn("Alerte de reconciliation du payout {} echouee: {}", payout.getId(), e.getMessage());
        }
    }

    private void notifySuccessQuietly(OwnerPayout payout) {
        try {
            notifier.notifySuccess(payout);
        } catch (Exception e) {
            log.warn("Notification de succes du payout {} echouee: {}", payout.getId(), e.getMessage());
        }
    }

    private OwnerPayout failPayout(OwnerPayout payout, String reason) {
        payout.setStatus(PayoutStatus.FAILED);
        payout.setFailureReason(reason);
        payout.setRetryCount(payout.getRetryCount() + 1);
        OwnerPayout saved = payoutRepository.save(payout);
        try {
            notifier.notifyFailure(saved, reason);
        } catch (Exception e) {
            log.warn("Notification d'echec du payout {} echouee: {}", payout.getId(), e.getMessage());
        }
        log.error("Stripe Connect payout {} failed (attempt {}): {}",
            payout.getId(), payout.getRetryCount(), reason);
        return saved;
    }
}
