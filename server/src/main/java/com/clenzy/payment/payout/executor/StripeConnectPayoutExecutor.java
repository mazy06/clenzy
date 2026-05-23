package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.StripeConnectService;
import com.stripe.model.Transfer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Exécuteur Stripe Connect : transfert automatique vers le compte connecté
 * du propriétaire. Couverture EU + US + UK + ~40 pays.
 *
 * <p>Le propriétaire doit avoir complété l'onboarding Stripe Connect (Express)
 * et la config doit contenir un {@code stripeConnectedAccountId} valide.</p>
 */
@Component
public class StripeConnectPayoutExecutor implements PayoutExecutor {

    private static final Logger log = LoggerFactory.getLogger(StripeConnectPayoutExecutor.class);

    private final StripeConnectService stripeConnectService;
    private final OwnerPayoutRepository payoutRepository;
    private final PayoutNotifier notifier;

    public StripeConnectPayoutExecutor(StripeConnectService stripeConnectService,
                                        OwnerPayoutRepository payoutRepository,
                                        PayoutNotifier notifier) {
        this.stripeConnectService = stripeConnectService;
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

        try {
            String description = "Payout #" + payout.getId()
                + " - " + payout.getPeriodStart() + " to " + payout.getPeriodEnd();

            Transfer transfer = stripeConnectService.createTransfer(
                payout.getNetAmount(),
                payout.getCurrency(),
                config.getStripeConnectedAccountId(),
                description
            );

            payout.setStripeTransferId(transfer.getId());
            payout.setPaymentReference(transfer.getId());
            payout.setStatus(PayoutStatus.PAID);
            payout.setPaidAt(Instant.now());
            OwnerPayout saved = payoutRepository.save(payout);

            notifier.notifySuccess(saved);
            log.info("Stripe transfer {} completed for payout {}", transfer.getId(), payout.getId());
            return saved;
        } catch (Exception e) {
            return failPayout(payout, e.getMessage());
        }
    }

    private OwnerPayout failPayout(OwnerPayout payout, String reason) {
        payout.setStatus(PayoutStatus.FAILED);
        payout.setFailureReason(reason);
        payout.setRetryCount(payout.getRetryCount() + 1);
        OwnerPayout saved = payoutRepository.save(payout);
        notifier.notifyFailure(saved, reason);
        log.error("Stripe Connect payout {} failed (attempt {}): {}",
            payout.getId(), payout.getRetryCount(), reason);
        return saved;
    }
}
