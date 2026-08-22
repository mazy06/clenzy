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
 * webhook rejoue n'y repasse pas, l'horodatage n'est donc pose qu'une fois.</p>
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

        quoteRepository.findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                        tx.getSourceId(), tx.getOrganizationId())
                .stream()
                .filter(quote -> quote.getStatus() == ServiceQuote.Status.APPROVED)
                .filter(quote -> quote.getDepositPaidAt() == null)
                .findFirst()
                .ifPresent(quote -> {
                    quote.setDepositPaidAt(LocalDateTime.now());
                    quoteRepository.save(quote);
                    log.info("Acompte encaisse sur le devis {} (intervention {})",
                            quote.getId(), tx.getSourceId());
                });
    }
}
