package com.clenzy.payment.payout;

import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.stripe.exception.StripeException;
import com.stripe.param.TransferCreateParams;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import com.clenzy.service.payout.PayoutTransferInstruction;
import com.clenzy.service.payout.PayoutTransferJournal;
import com.clenzy.service.payout.PayoutReconciliationRequiredException;
import com.clenzy.service.payout.PayoutFundsUnavailableException;

import java.util.Locale;

/**
 * Client d'émission de transferts Stripe Connect vers un compte connecté —
 * couche adaptateur unique du versement Stripe Connect.
 *
 * <p>Partagé par les deux flux de versement Stripe Connect : les payouts
 * propriétaire ({@code StripeConnectPayoutExecutor}) et les versements prestataires
 * ({@code HousekeeperPayoutService}). Ainsi les services métier ne manipulent
 * plus les types du SDK Stripe ({@code TransferCreateParams}, {@code Transfer}) :
 * seul cet adaptateur les connaît.</p>
 *
 * <p>Le journal durable bloque les réémissions, même après expiration de la clé
 * d'idempotence du PSP. Une réponse incertaine impose un rapprochement. La référence
 * d'un transfert connu est rejouée localement sans nouvel appel Stripe.</p>
 */
@Component
public class StripeConnectTransferClient {

    private final StripeGateway stripeGateway;
    private final PayoutTransferJournal journal;

    public StripeConnectTransferClient(StripeGateway stripeGateway, PayoutTransferJournal journal) {
        this.stripeGateway = stripeGateway;
        this.journal = journal;
    }

    /**
     * Émet un transfert Stripe Connect et retourne l'identifiant du transfert.
     *
     * @param instruction ordre résolu et vérifié côté serveur
     * @return l'identifiant du transfert Stripe créé
     * @throws StripeException en cas d'échec de l'appel Stripe
     */
    public String createTransfer(PayoutTransferInstruction instruction) throws StripeException {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Un transfert PSP doit être exécuté hors transaction de base de données.");
        }
        var known = journal.previous(instruction);
        if (known.isPresent()) return known.get();
        requireAvailableFunds(instruction);
        TransferCreateParams params = TransferCreateParams.builder()
            .setAmount(StripeAmounts.toMinorUnits(instruction.amount()))
            .setCurrency(instruction.currency().toLowerCase(Locale.ROOT))
            .setDestination(instruction.destination())
            .setDescription(instruction.description())
            .setSourceType(TransferCreateParams.SourceType.CARD)
            .putAllMetadata(com.clenzy.service.payout.PayoutTransferEvidence.metadata(instruction))
            .build();
        var previous = journal.prepare(instruction);
        if (previous.isPresent()) return previous.get();
        String reference = null;
        try {
            var receipt = stripeGateway.createTransfer(params, instruction.idempotencyKey());
            reference = receipt.getId();
            journal.transferred(instruction, reference, receipt.getDestinationPayment(), receipt.getLivemode());
            return reference;
        } catch (Exception failure) {
            // Une erreur réseau ou de persistance ne prouve jamais que l'argent n'est pas parti.
            try { journal.uncertain(instruction); }
            catch (RuntimeException journalFailure) { failure.addSuppressed(journalFailure); }
            throw new PayoutReconciliationRequiredException(
                    "Résultat du transfert à rapprocher auprès du PSP. Aucune nouvelle émission automatique autorisée.",
                    reference, failure);
        }
    }

    /** Précontrôle informatif, pas une réservation : Stripe arbitre aussi les dépenses concurrentes. */
    private void requireAvailableFunds(PayoutTransferInstruction instruction) {
        com.stripe.model.Balance balance;
        try {
            balance = stripeGateway.retrievePlatformBalance();
        } catch (StripeException | RuntimeException unavailable) {
            // Aucun appel d'émission n'a encore eu lieu, y compris si le client PSP est mal configuré.
            throw new PayoutFundsUnavailableException("Solde Stripe indisponible. Aucun transfert émis ; vérification à relancer.", unavailable);
        }
        if (balance == null || balance.getAvailable() == null) {
            throw new PayoutFundsUnavailableException("Solde Stripe disponible non vérifiable. Aucun transfert émis.");
        }
        var matching = balance.getAvailable().stream()
                .filter(row -> row != null && instruction.currency().equalsIgnoreCase(row.getCurrency())).toList();
        if (matching.size() != 1) throw new PayoutFundsUnavailableException("Solde disponible dans la devise requise introuvable. Aucun transfert émis.");
        var row = matching.getFirst();
        Long card = row.getSourceTypes() == null ? null : row.getSourceTypes().getCard();
        long required = StripeAmounts.toMinorUnits(instruction.amount());
        if (row.getAmount() == null || card == null || row.getAmount() < required || card < required) {
            throw new PayoutFundsUnavailableException("Solde Stripe disponible insuffisant pour ce versement. Aucun transfert émis ; relance possible après disponibilité des fonds.");
        }
    }
}
