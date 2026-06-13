package com.clenzy.payment.payout;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Transitions d'etat des payouts pilotees par les webhooks externes
 * (Wise, GoCardless).
 *
 * <p>Les webhooks sont livres at-least-once : chaque transition passe par un
 * UPDATE conditionnel (compare-and-set, pattern
 * {@code PaymentStatusTransitionService}) — jamais de check-then-act sur le
 * statut. Deux livraisons concurrentes se serialisent sur le verrou de ligne :
 * une seule effectue la transition et notifie, l'autre est un no-op.</p>
 *
 * <p>Pas de validation d'org ici : flux systeme authentifie par la signature
 * du webhook (verifiee au controller), le lookup par {@code paymentReference}
 * est global par construction.</p>
 */
@Service
public class PayoutWebhookService {

    private static final Logger log = LoggerFactory.getLogger(PayoutWebhookService.class);

    private final OwnerPayoutRepository payoutRepository;
    private final PayoutNotifier notifier;
    private final NotificationService notificationService;

    public PayoutWebhookService(OwnerPayoutRepository payoutRepository,
                                PayoutNotifier notifier,
                                NotificationService notificationService) {
        this.payoutRepository = payoutRepository;
        this.notifier = notifier;
        this.notificationService = notificationService;
    }

    /**
     * Resout le payout vise par un webhook via sa reference de paiement
     * (ex: {@code "WISE:<transferId>"}, {@code "GOCARDLESS:<paymentId>"}).
     */
    @Transactional(readOnly = true)
    public Optional<OwnerPayout> findByPaymentReference(String paymentReference) {
        return payoutRepository.findFirstByPaymentReference(paymentReference);
    }

    /**
     * Marque le payout PAID (idempotent). Si le payout est deja PAID, aucun
     * effet — pas de double notification sur re-livraison du webhook.
     */
    @Transactional
    public void markPaid(OwnerPayout payout, String provider, String externalReference) {
        int updated = payoutRepository.markPaidIfNotAlreadyPaid(
            payout.getId(), PayoutStatus.PAID, Instant.now());
        if (updated == 0) {
            log.debug("{} webhook : payout {} deja PAID, idempotence", provider, payout.getId());
            return;
        }
        OwnerPayout saved = payoutRepository.findById(payout.getId()).orElse(payout);
        notifier.notifySuccess(saved);
        log.info("{} webhook : payout {} marque PAID (ref={})",
            provider, payout.getId(), externalReference);
    }

    /**
     * Marque le payout FAILED (idempotent vis-a-vis de PAID). Si le payout est
     * deja PAID, le statut n'est pas ecrase : le revert (refund/chargeback) est
     * escalade aux admins de l'org avec le titre/message fournis par l'appelant.
     */
    @Transactional
    public void markFailed(OwnerPayout payout, String reason,
                           String revertTitle, String revertMessage) {
        int updated = payoutRepository.markFailedIfNotPaid(
            payout.getId(), PayoutStatus.FAILED, reason, PayoutStatus.PAID);
        if (updated == 0) {
            log.warn("Payout webhook : payout {} deja PAID, ignore state {}",
                payout.getId(), reason);
            // On notifie quand meme les admins car c'est un cas anormal (refund/chargeback)
            notificationService.notifyAdminsAndManagersByOrgId(
                payout.getOrganizationId(),
                NotificationKey.PAYOUT_FAILED,
                revertTitle,
                revertMessage,
                "/billing?tab=payouts&highlight=" + payout.getId());
            return;
        }
        OwnerPayout saved = payoutRepository.findById(payout.getId()).orElse(payout);
        notifier.notifyFailure(saved, reason);
        log.warn("Payout webhook : payout {} marque FAILED ({})", payout.getId(), reason);
    }
}
