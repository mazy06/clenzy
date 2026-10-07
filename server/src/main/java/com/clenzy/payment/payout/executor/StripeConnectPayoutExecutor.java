package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.payment.payout.StripeConnectTransferClient;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.model.PayoutTransfer;
import com.clenzy.service.payout.PayoutTransferInstruction;
import com.clenzy.service.payout.PayoutReconciliationRequiredException;
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
 *
 * <p>Le journal commun fige l'instruction avant émission. Un transfert confirmé est
 * rejoué localement ; tout résultat incertain impose un rapprochement. La clé Stripe
 * historique est conservée, sans dépendre de sa durée de rétention.</p>
 * <p>Un échec de persistance après émission alerte les équipes plateforme. Le statut
 * métier PAID reste celui du flux historique ; le journal distingue le transfert PSP
 * de la réception bancaire, qui n'est pas prouvée par un transfert Connect.</p>
 */
@Component
public class StripeConnectPayoutExecutor implements PayoutExecutor {

    private static final Logger log = LoggerFactory.getLogger(StripeConnectPayoutExecutor.class);

    private final StripeConnectTransferClient transferClient;
    private final OwnerPayoutRepository payoutRepository;
    private final PayoutNotifier notifier;

    public StripeConnectPayoutExecutor(StripeConnectTransferClient transferClient,
                                        OwnerPayoutRepository payoutRepository,
                                        PayoutNotifier notifier) {
        this.transferClient = transferClient;
        this.payoutRepository = payoutRepository;
        this.notifier = notifier;
    }

    @Override
    public PayoutMethod getSupportedMethod() {
        return PayoutMethod.STRIPE_CONNECT;
    }

    @Override
    public void validate(OwnerPayout payout, OwnerPayoutConfig config) {
        if (config.getStripeConnectedAccountId() == null || config.getStripeConnectedAccountId().isBlank()) {
            throw new PayoutExecutionException(
                "Stripe Connect : compte connecte manquant pour le proprietaire.");
        }

    }

    @Override
    public OwnerPayout execute(OwnerPayout payout, OwnerPayoutConfig config) {
        validate(payout, config);

        payout.setStatus(PayoutStatus.PROCESSING);
        payout.setPayoutMethod(PayoutMethod.STRIPE_CONNECT);
        payoutRepository.save(payout);

        String description = "Payout #" + payout.getId()
            + " - " + payout.getPeriodStart() + " to " + payout.getPeriodEnd();

        // L'adaptateur distingue un refus avant émission d'un résultat PSP incertain.
        String transferId;
        try {
            transferId = transferClient.createTransfer(new PayoutTransferInstruction(
                payout.getOrganizationId(), PayoutTransfer.Source.OWNER_PAYOUT, payout.getId(), payout.getOwnerId(),
                payout.getNetAmount(), payout.getCurrency(), config.getStripeConnectedAccountId(), description));
        } catch (PayoutReconciliationRequiredException e) {
            payout.setFailureReason(e.getMessage());
            notifyReconciliationQuietly(payout, e.getTransferReference() != null ? e.getTransferReference() : "À rapprocher");
            try { payoutRepository.save(payout); }
            catch (RuntimeException persistenceFailure) { e.addSuppressed(persistenceFailure); }
            throw e;
        } catch (Exception e) {
            return failPayout(payout, e.getMessage());
        }

        OwnerPayout saved = persistTransferResult(payout, transferId);
        notifySuccessQuietly(saved);
        log.info("Stripe transfer {} completed for payout {}", transferId, payout.getId());
        return saved;
    }

    /**
     * Persiste le resultat du transfert. Un echec ici ne doit PAS marquer le
     * payout FAILED (l'argent est parti) : log ERROR + ALERTE de reconciliation
     * structuree vers les admins/managers (un humain doit reconcilier, pas
     * seulement un log — regle audit n°7) puis propagation d'une exception
     * explicite. Le journal conserve la référence du transfert déjà émis.
     */
    private OwnerPayout persistTransferResult(OwnerPayout payout, String transferId) {
        try {
            payout.setStripeTransferId(transferId);
            payout.setPaymentReference(transferId);
            payout.setStatus(PayoutStatus.PAID);
            payout.setPaidAt(Instant.now());
            return payoutRepository.save(payout);
        } catch (Exception e) {
            log.error("Transfert Stripe {} emis pour le payout {} mais la persistance a echoue — "
                + "rapprochement requis, référence conservée dans le journal.",
                transferId, payout.getId(), e);
            notifyReconciliationQuietly(payout, transferId);
            throw new PayoutExecutionException(
                "Le virement Stripe a ete emis (ref " + transferId
                + ") mais son enregistrement a echoue. Ne pas re-executer via un autre rail — "
                + "rapprochez le statut métier avec la référence conservée dans le journal.", e);
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
