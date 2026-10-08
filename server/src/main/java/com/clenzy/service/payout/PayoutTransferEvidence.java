package com.clenzy.service.payout;

import com.clenzy.model.PayoutTransfer;
import com.clenzy.payment.StripeAmounts;
import com.stripe.model.Transfer;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/** Preuve copiée depuis une lecture Stripe serveur. Jamais désérialisée depuis une requête client. */
public record PayoutTransferEvidence(String reference, Long amount, String currency, String destination,
        String destinationPayment, Boolean livemode, Instant createdAt, Map<String, String> metadata) {
    public static Map<String, String> metadata(PayoutTransferInstruction instruction) {
        return metadata(instruction.organizationId(), instruction.source(), instruction.sourceId(),
                instruction.beneficiaryUserId(), instruction.beneficiaryOrganizationId(), instruction.idempotencyKey());
    }
    private static Map<String, String> metadata(Long org, PayoutTransfer.Source source, Long sourceId,
            Long user, Long company, String key) {
        return Map.of("baitly_organization_id", org.toString(), "baitly_source", source.name(),
                "baitly_source_id", sourceId.toString(), "baitly_payout_key", key,
                "baitly_beneficiary", user != null ? "user:" + user : "organization:" + company);
    }
    public static PayoutTransferEvidence from(Transfer receipt, String requestedReference) {
        if (receipt == null || !Objects.equals(receipt.getId(), requestedReference)
                || !Boolean.FALSE.equals(receipt.getReversed()) || !Long.valueOf(0).equals(receipt.getAmountReversed())
                || receipt.getCreated() == null || receipt.getLivemode() == null
                || receipt.getDestinationPayment() == null || receipt.getDestinationPayment().isBlank()) {
            throw conflict();
        }
        return new PayoutTransferEvidence(receipt.getId(), receipt.getAmount(), receipt.getCurrency(),
                receipt.getDestination(), receipt.getDestinationPayment(), receipt.getLivemode(),
                Instant.ofEpochSecond(receipt.getCreated()), receipt.getMetadata() == null ? Map.of() : Map.copyOf(receipt.getMetadata()));
    }
    public void verify(PayoutTransfer transfer) {
        boolean knownReference = reference.equals(transfer.getExternalReference());
        boolean boundInstruction = metadata.entrySet().containsAll(metadata(transfer.getOrganizationId(), transfer.getSource(),
                transfer.getSourceId(), transfer.getBeneficiaryUserId(), transfer.getBeneficiaryOrganizationId(),
                transfer.getIdempotencyKey()).entrySet());
        if (!"STRIPE".equals(transfer.getProvider()) || (!knownReference && !boundInstruction)
                || (transfer.getExternalReference() != null && !knownReference)
                || !Objects.equals(amount, StripeAmounts.toMinorUnits(transfer.getAmount()))
                || !transfer.getCurrency().equalsIgnoreCase(currency) || !transfer.getDestination().equals(destination)
                || (transfer.getStripeLivemode() != null && !transfer.getStripeLivemode().equals(livemode))) {
            throw conflict();
        }
    }
    static ResponseStatusException conflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT,
                "Preuve Stripe incompatible ou insuffisante. Aucun transfert ni changement de statut effectué.");
    }
}
