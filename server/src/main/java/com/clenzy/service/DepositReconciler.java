package com.clenzy.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.model.ServiceQuote;
import com.clenzy.repository.ServiceQuoteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Rapproche un encaissement d'acompte du devis qui l'a exige.
 *
 * <p>L'acompte ne laissait aucune trace lisible : on le devinait a la cle
 * d'idempotence de la transaction (« INT-97-DEPOSIT-… »), un detail
 * d'implementation. Il fallait donc le deviner a chaque lecture, et rien ne
 * permettait de le deduire du solde.</p>
 *
 * <p>Branche sur {@code completeTransaction}, apres son compare-and-set : un
 * webhook rejoué contrôle la même preuve sans changer l'horodatage.</p>
 */
@Component
public class DepositReconciler {

    private static final Logger log = LoggerFactory.getLogger(DepositReconciler.class);

    private final ServiceQuoteRepository quoteRepository;

    public DepositReconciler(ServiceQuoteRepository quoteRepository) {
        this.quoteRepository = quoteRepository;
    }

    /** Vrai si la transaction reglait un acompte. */
    public static boolean isDeposit(PaymentTransaction tx) {
        Map<String, Object> metadata = tx.getMetadata();
        if (metadata != null && "DEPOSIT".equals(String.valueOf(metadata.get("purpose")))) {
            return true;
        }
        // Repli sur la cle : les transactions d'avant le champ `purpose`.
        return tx.getIdempotencyKey() != null && tx.getIdempotencyKey().contains("-DEPOSIT");
    }

    public void onPaymentCompleted(PaymentTransaction tx) {
        if (!"INTERVENTION".equals(tx.getSourceType()) || tx.getSourceId() == null) return;
        if (!isDeposit(tx)) return;

        var approved=quoteRepository.findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                        tx.getSourceId(), tx.getOrganizationId())
                .stream()
                .filter(quote -> quote.getStatus() == ServiceQuote.Status.APPROVED)
                .toList();
        if(approved.size()!=1)throw new IllegalStateException("Le devis d'acompte doit être rapproché");
        var quote=quoteRepository.lockByIdAndOrganizationId(approved.getFirst().getId(),tx.getOrganizationId()).orElseThrow();
        validate(tx,quote);
        quote.setDepositTransactionRef(tx.getTransactionRef());
        if(quote.getDepositPaidAt()==null)quote.setDepositPaidAt(LocalDateTime.now());
        quoteRepository.save(quote);
        log.info("Acompte encaissé sur le devis {} (intervention {})",quote.getId(),tx.getSourceId());
    }

    static void validate(PaymentTransaction tx,ServiceQuote quote) {
        if(tx.getStatus()!=com.clenzy.model.TransactionStatus.COMPLETED
                || tx.getPaymentType()!=com.clenzy.model.TransactionType.CHECKOUT
                || tx.getTransactionRef()==null || tx.getProviderTxId()==null
                || quote.getStatus()!=ServiceQuote.Status.APPROVED
                || !java.util.Objects.equals(tx.getOrganizationId(),quote.getOrganizationId())
                || !java.util.Objects.equals(tx.getSourceId(),quote.getInterventionId())
                || tx.getAmount()==null || tx.getAmount().signum()<=0 || quote.getDepositAmount()==null
                || tx.getAmount().compareTo(quote.getDepositAmount())!=0
                || quote.getAmount()==null || quote.getAmount().compareTo(tx.getAmount())<0
                || tx.getCurrency()==null || !tx.getCurrency().equalsIgnoreCase(quote.getCurrency())
                || (quote.getDepositTransactionRef()!=null && !quote.getDepositTransactionRef().equals(tx.getTransactionRef())))
            throw new IllegalStateException("L'encaissement ne correspond pas à l'acompte du devis");
    }

    /** Contrôle sous le verrou de mission avant d'engager le solde, y compris dans un lot. */
    static void requireAvailableDeposit(com.clenzy.model.Intervention mission, java.util.List<ServiceQuote> quotes,
            java.util.List<PaymentTransaction> history) {
        var accepted = quotes.stream().filter(q -> q.getStatus() == ServiceQuote.Status.APPROVED).toList();
        if (accepted.size() > 1) throw new com.clenzy.exception.PaymentValidationException("Plusieurs devis approuvés : rapprochement requis");
        var deposits = history.stream().filter(tx -> tx.getPaymentType() == com.clenzy.model.TransactionType.CHECKOUT)
                .filter(DepositReconciler::isDeposit)
                .filter(com.clenzy.model.BaitlyCheckoutEvidence::requiresReconciliation).toList();
        if (deposits.isEmpty() && (accepted.isEmpty()
                || accepted.getFirst().getDepositPaidAt() == null && accepted.getFirst().getDepositTransactionRef() == null)) return;
        if (deposits.size() != 1 || accepted.size() != 1)
            throw new com.clenzy.exception.PaymentValidationException("L'acompte doit être rapproché avant le paiement du solde");
        var tx = deposits.getFirst();
        var quote = accepted.getFirst();
        validate(tx, quote);
        if (quote.getDepositPaidAt() == null || !tx.getTransactionRef().equals(quote.getDepositTransactionRef())
                || tx.hasDisputeRisk() || !java.util.Objects.equals(mission.getOrganizationId(), tx.getOrganizationId())
                || !java.util.Objects.equals(mission.getId(), tx.getSourceId())
                || mission.getEstimatedCost() == null || mission.getEstimatedCost().compareTo(quote.getAmount()) != 0
                || mission.getCurrency() == null || !mission.getCurrency().equalsIgnoreCase(tx.getCurrency())
                || history.stream().anyMatch(row -> row.getPaymentType() == com.clenzy.model.TransactionType.REFUND
                    && !BaitlyExternalRefundStore.rejectedBeforeAccounting(row)))
            throw new com.clenzy.exception.PaymentValidationException("Acompte contesté, remboursé ou non rapproché : vérifiez le dossier avant de payer le solde");
    }
}
