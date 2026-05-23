package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.repository.OwnerPayoutRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Exécuteur SEPA Transfer : génération du XML pain.001 par l'admin, virement
 * manuel sur le portail bancaire Clenzy, puis confirmation "Marquer comme paye".
 *
 * <p>Cet exécuteur ne fait que marquer le payout en {@code PROCESSING} et
 * notifier les admins qu'il faut effectuer le virement à la main. Le passage
 * en {@code PAID} se fait via {@code AccountingService.markAsPaid()} après le
 * virement bancaire effectif.</p>
 *
 * <p>Pour automatiser ce flow, voir {@link OpenBankingPayoutExecutor} (à venir
 * en PR9) qui initie le virement automatiquement via PSD2 Payment Initiation
 * Service.</p>
 */
@Component
public class SepaTransferPayoutExecutor implements PayoutExecutor {

    private static final Logger log = LoggerFactory.getLogger(SepaTransferPayoutExecutor.class);

    private final OwnerPayoutRepository payoutRepository;
    private final PayoutNotifier notifier;

    public SepaTransferPayoutExecutor(OwnerPayoutRepository payoutRepository, PayoutNotifier notifier) {
        this.payoutRepository = payoutRepository;
        this.notifier = notifier;
    }

    @Override
    public PayoutMethod getSupportedMethod() {
        return PayoutMethod.SEPA_TRANSFER;
    }

    @Override
    public OwnerPayout execute(OwnerPayout payout, OwnerPayoutConfig config) {
        if (config.getIban() == null || config.getIban().isBlank()) {
            throw new PayoutExecutionException(
                "SEPA Transfer : IBAN du proprietaire absent.");
        }

        payout.setStatus(PayoutStatus.PROCESSING);
        payout.setPayoutMethod(PayoutMethod.SEPA_TRANSFER);
        OwnerPayout saved = payoutRepository.save(payout);

        notifier.notifySepaPending(saved);
        log.info("SEPA payout {} marked as PROCESSING, awaiting manual bank transfer", payout.getId());
        return saved;
    }
}
