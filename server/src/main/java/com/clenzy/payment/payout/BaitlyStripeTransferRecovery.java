package com.clenzy.payment.payout;

import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.service.payout.BaitlyTransferRecoveryStore.Instruction;
import com.stripe.model.TransferReversal;
import com.stripe.param.TransferReversalCreateParams;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.Instant;
import java.util.Objects;

/** Récupère seulement le transfert exact de la décision durable, après remboursement confirmé. */
@Component
public class BaitlyStripeTransferRecovery {
    private final StripeGateway stripe;
    public BaitlyStripeTransferRecovery(StripeGateway stripe) { this.stripe = stripe; }

    public String recover(Instruction instruction) throws com.stripe.exception.StripeException {
        require(!TransactionSynchronizationManager.isActualTransactionActive(), "NETWORK_INSIDE_TRANSACTION");
        var transfer = stripe.retrieveTransfer(instruction.transferReference());
        require(transfer != null && Objects.equals(transfer.getId(), instruction.transferReference())
                && Objects.equals(transfer.getAmount(), StripeAmounts.toMinorUnits(instruction.transferAmount()))
                && instruction.currency().equalsIgnoreCase(transfer.getCurrency())
                && Objects.equals(transfer.getDestination(), instruction.destination())
                && Objects.equals(transfer.getDestinationPayment(), instruction.destinationPayment())
                && instruction.livemode() != null && instruction.livemode().equals(transfer.getLivemode()), "TRANSFER_MISMATCH");
        var reversals = stripe.listTransferReversals(instruction.transferReference());
        var ours = reversals.stream().filter(r -> r.getMetadata() != null
                && instruction.id().toString().equals(r.getMetadata().get("baitly_recovery_id"))).toList();
        require(ours.size() <= 1, "DUPLICATE_RECOVERY_PROOF");
        TransferReversal reversal;
        if (ours.isEmpty()) {
            long previousAmount = 0;
            var references = new java.util.HashSet<String>();
            require(reversals.size() == instruction.previous().size(), "EXTERNAL_REVERSAL_REQUIRES_REVIEW");
            for (var previous : instruction.previous()) {
                require(previous.reference() != null && previous.reference().startsWith("trr_")
                        && references.add(previous.reference()) && previous.amount().signum() > 0
                        && reversals.stream().filter(r -> previous.reference().equals(r.getId())).count() == 1,
                        "PREVIOUS_RECOVERY_PROOF_MISMATCH");
                var canonical = stripe.retrieveTransferReversal(instruction.transferReference(),previous.reference());
                requireProof(canonical,previous.reference(),instruction.transferReference(),previous.amount(),
                        instruction.currency(),previous.metadata());
                previousAmount = Math.addExact(previousAmount,StripeAmounts.toMinorUnits(previous.amount()));
            }
            require(Long.valueOf(previousAmount).equals(transfer.getAmountReversed())
                    && Boolean.FALSE.equals(transfer.getReversed()), "EXTERNAL_REVERSAL_REQUIRES_REVIEW");
            require(instruction.amount().signum() > 0 && Math.addExact(previousAmount,StripeAmounts.toMinorUnits(instruction.amount()))
                    <= StripeAmounts.toMinorUnits(instruction.transferAmount()), "RECOVERY_EXCEEDS_TRANSFER");
            // Une réponse perdue ancienne exige une preuve, jamais une nouvelle clé après expiration Stripe.
            require(instruction.firstAttemptAt() != null
                    && instruction.firstAttemptAt().isAfter(Instant.now().minusSeconds(23 * 3600)), "RECOVERY_WINDOW_EXPIRED");
            var params = TransferReversalCreateParams.builder().setAmount(StripeAmounts.toMinorUnits(instruction.amount()))
                    .putAllMetadata(instruction.metadata()).build();
            reversal = stripe.createTransferReversal(instruction.transferReference(), params, instruction.key());
            require(reversal != null && reversal.getId() != null, "RECOVERY_RESPONSE_MISSING");
        } else reversal = ours.getFirst();
        String expectedReference = reversal.getId();
        reversal = stripe.retrieveTransferReversal(instruction.transferReference(), expectedReference);
        requireProof(reversal,expectedReference,instruction.transferReference(),instruction.amount(),instruction.currency(),instruction.metadata());
        return reversal.getId();
    }

    private static void requireProof(TransferReversal reversal, String expectedReference, String transferReference,
            java.math.BigDecimal amount, String currency, java.util.Map<String,String> metadata) {
        require(reversal != null && Objects.equals(expectedReference, reversal.getId())
                && reversal.getId() != null && reversal.getId().startsWith("trr_")
                && Objects.equals(reversal.getTransfer(), transferReference)
                && Objects.equals(reversal.getAmount(), StripeAmounts.toMinorUnits(amount))
                && currency.equalsIgnoreCase(reversal.getCurrency())
                && reversal.getBalanceTransaction() != null && reversal.getCreated() != null
                && reversal.getMetadata() != null && reversal.getMetadata().entrySet().containsAll(metadata.entrySet()),
                "RECOVERY_PROOF_MISMATCH");
    }
    private static void require(boolean ok, String code) { if (!ok) throw new IllegalStateException(code); }
}
