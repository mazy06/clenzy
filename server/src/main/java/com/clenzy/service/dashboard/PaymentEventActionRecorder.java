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
    private final com.clenzy.service.agent.supervision.SupervisionSuggestionService supervisionSuggestionService;
    private final com.clenzy.repository.PropertyRepository propertyRepository;
    private final com.clenzy.repository.PaymentDisputeRepository paymentDisputeRepository;
    private final java.time.Clock clock;

    public PaymentEventActionRecorder(ActionItemWriter writer,
                                      PaymentTransactionRepository paymentTransactionRepository,
                                      OwnerPayoutRepository ownerPayoutRepository,
                                      com.clenzy.service.agent.supervision.SupervisionSuggestionService supervisionSuggestionService,
                                      com.clenzy.repository.PropertyRepository propertyRepository,
                                      com.clenzy.repository.PaymentDisputeRepository paymentDisputeRepository,
                                      java.time.Clock clock) {
        this.writer = writer;
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.ownerPayoutRepository = ownerPayoutRepository;
        this.supervisionSuggestionService = supervisionSuggestionService;
        this.propertyRepository = propertyRepository;
        this.paymentDisputeRepository = paymentDisputeRepository;
        this.clock = clock;
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
        // Dossier de litige (M6) : persisté avec le lien réservation quand la
        // transaction le porte — c'est lui que « Soumettre » dépose à Stripe.
        try {
            final com.clenzy.model.PaymentDispute dispute = persistDispute(
                    orgId, chargeId, disputeId, amount, currency, deadline);
            final Long anchor = propertyRepository.findFirstPropertyIdByOrg(orgId);
            if (dispute != null && anchor != null) {
                supervisionSuggestionService.recordActionable(orgId, anchor, "fin",
                        "Litige bancaire reçu (" + disputeId + ")",
                        "Contestation de " + (amount != null ? amount + " " + currency : "montant inconnu")
                                + (deadline != null ? ", preuves à soumettre avant " + deadline : "")
                                + ". « Soumettre » assemble le dossier depuis vos données (séjour, "
                                + "fiche voyageur, livret transmis) et le dépose à Stripe — sans "
                                + "réponse avant l'échéance, le litige est perdu.",
                        com.clenzy.service.agent.supervision.SupervisionActionType.CHARGEBACK_SUBMIT,
                        "{\"disputeId\":" + dispute.getId() + "}",
                        amount != null ? amount.movePointRight(2)
                                .setScale(0, java.math.RoundingMode.HALF_UP).longValueExact() : null,
                        "critical");
            }
        } catch (Exception e) {
            log.debug("Carte litige constellation non enregistrée (dispute {}): {}",
                    disputeId, e.getMessage());
        }
    }

    /** Persistance idempotente du litige (unique provider_dispute_id). */
    private com.clenzy.model.PaymentDispute persistDispute(Long orgId, String chargeId,
                                                           String disputeId, BigDecimal amount,
                                                           String currency, Instant deadline) {
        final var existing = paymentDisputeRepository.findByProviderDisputeId(disputeId);
        if (existing.isPresent()) {
            return existing.get();
        }
        final com.clenzy.model.PaymentDispute dispute = new com.clenzy.model.PaymentDispute();
        dispute.setOrganizationId(orgId);
        dispute.setProviderDisputeId(disputeId);
        dispute.setChargeId(chargeId);
        dispute.setAmount(amount);
        dispute.setCurrency(currency);
        dispute.setDueBy(deadline);
        // Lien réservation quand la transaction du charge le porte.
        paymentTransactionRepository.findByProviderTxId(chargeId)
                .filter(tx -> tx.getSourceType() != null
                        && tx.getSourceType().toLowerCase(java.util.Locale.ROOT).contains("reservation"))
                .ifPresent(tx -> dispute.setReservationId(tx.getSourceId()));
        try {
            return paymentDisputeRepository.save(dispute);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return paymentDisputeRepository.findByProviderDisputeId(disputeId).orElse(null);
        }
    }

    /** Le fournisseur a tranché : l'action n'appelle plus de décision. */
    @org.springframework.transaction.annotation.Transactional
    public void recordDisputeClosed(String chargeId, String disputeId, String outcome) {
        final Long orgId = organizationOfProviderTx(chargeId);
        if (orgId == null) return;
        writer.resolve(orgId, ActionItemKind.PAYMENT_INCIDENT, disputeId, "stripe:" + outcome);
        // Registre M6 : l'issue est tracée (WON/LOST), quel que soit l'état intermédiaire.
        paymentDisputeRepository.markClosed(disputeId,
                "won".equalsIgnoreCase(outcome)
                        ? com.clenzy.model.PaymentDispute.Status.WON
                        : com.clenzy.model.PaymentDispute.Status.LOST,
                outcome, clock.instant());
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
