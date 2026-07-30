package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.dashboard.ActionItemWriter.EventAction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Traduit les événements du fournisseur de paiement en actions à traiter.
 *
 * <p>Trois faits arrivaient par webhook et repartaient sans laisser de trace :
 * un litige ouvert, un virement échoué après avoir été marqué payé, un lien de
 * paiement expiré. Chacun appelle une décision humaine, et aucun n'existe dans
 * nos données — d'où l'écriture directe, en régime « événement ».</p>
 *
 * <p><b>L'organisation vient toujours de NOTRE base</b>, jamais du message
 * reçu : un événement forgé ne doit pas pouvoir choisir le tenant dans lequel
 * il écrit. C'est ici, et nulle part ailleurs, que cette résolution se fait —
 * et c'est aussi pourquoi elle n'est pas dans le controller, qui n'a pas à
 * connaître les repositories.</p>
 */
@Service
public class PaymentEventActionRecorder {

    /** Sous-natures, pour que l'écran sache quel geste proposer. */
    public static final String DISPUTE_OPENED = "DISPUTE_OPENED";
    public static final String TRANSFER_FAILED = "TRANSFER_FAILED";
    public static final String SESSION_EXPIRED = "SESSION_EXPIRED";

    private static final Logger log = LoggerFactory.getLogger(PaymentEventActionRecorder.class);

    private final ActionItemWriter writer;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final OwnerPayoutRepository ownerPayoutRepository;

    public PaymentEventActionRecorder(ActionItemWriter writer,
                                      PaymentTransactionRepository paymentTransactionRepository,
                                      OwnerPayoutRepository ownerPayoutRepository) {
        this.writer = writer;
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.ownerPayoutRepository = ownerPayoutRepository;
    }

    /** Litige : la somme est déjà retenue, et l'échéance décide de tout. */
    public void recordDisputeOpened(String chargeId, String disputeId,
                                    BigDecimal amount, String currency, Instant deadline) {
        final Long orgId = organizationOfProviderTx(chargeId);
        if (orgId == null) {
            log.error("SECURITE : litige {} sans organisation identifiable (charge={})",
                    disputeId, chargeId);
            return;
        }
        writer.record(new EventAction(orgId, ActionItemKind.PAYMENT_INCIDENT, disputeId,
                "critical", "Litige bancaire à contester",
                "Le voyageur a contesté ce paiement auprès de sa banque.",
                null, amount, currency, deadline, DISPUTE_OPENED));
    }

    /** Le fournisseur a tranché : l'action n'appelle plus de décision. */
    public void recordDisputeClosed(String chargeId, String disputeId, String outcome) {
        final Long orgId = organizationOfProviderTx(chargeId);
        if (orgId == null) return;
        writer.resolve(orgId, ActionItemKind.PAYMENT_INCIDENT, disputeId, "stripe:" + outcome);
    }

    /**
     * Virement refusé après avoir été marqué payé.
     *
     * <p>L'écran continuait d'affirmer que le propriétaire avait été réglé
     * alors que l'argent était revenu.</p>
     */
    public void recordTransferFailed(String transferId, String currency) {
        ownerPayoutRepository.findByStripeTransferId(transferId).ifPresentOrElse(
                payout -> writer.record(new EventAction(
                        payout.getOrganizationId(), ActionItemKind.PAYMENT_INCIDENT, transferId,
                        "critical", "Virement échoué",
                        "Le virement a échoué après avoir été marqué payé : le bénéficiaire n'a rien reçu.",
                        payout.getId(), payout.getNetAmount(), currency, null, TRANSFER_FAILED)),
                () -> log.error("SECURITE : transfer.failed {} sans reversement correspondant",
                        transferId));
    }

    /**
     * Lien de paiement expiré sans règlement.
     *
     * <p>Sans cela la transaction reste « en cours » indéfiniment : la somme est
     * comptée comme en cours d'encaissement alors qu'elle ne rentrera jamais.</p>
     */
    public void recordSessionExpired(String sessionId, BigDecimal amount, String currency) {
        final Long orgId = organizationOfProviderTx(sessionId);
        if (orgId == null) {
            log.warn("Session expiree {} sans organisation identifiable", sessionId);
            return;
        }
        writer.record(new EventAction(orgId, ActionItemKind.PAYMENT_INCIDENT, sessionId,
                "warning", "Lien de paiement expiré",
                "Le lien a expiré sans être réglé : à renvoyer si la somme est toujours due.",
                null, amount, currency, null, SESSION_EXPIRED));
    }

    /** L'organisation propriétaire d'une référence fournisseur, selon nos écritures. */
    private Long organizationOfProviderTx(String providerTxId) {
        if (providerTxId == null || providerTxId.isBlank()) return null;
        return paymentTransactionRepository.findByProviderTxId(providerTxId)
                .map(PaymentTransaction::getOrganizationId)
                .orElse(null);
    }
}
