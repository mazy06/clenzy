package com.clenzy.service.payout;

import com.clenzy.dto.PayoutTransferDto;
import com.clenzy.payment.StripeGateway;
import com.clenzy.payment.payout.StripeConnectTransferClient;
import com.clenzy.repository.PayoutTransferRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Émission explicite d'une dépense retenue, jamais une simple modification de statut. */
@Service
@Transactional(propagation = Propagation.NEVER)
public class BaitlyExpensePayoutService {
    public record Preview(boolean eligible, String reason,BaitlyExpenseBeneficiaryService.Choice beneficiary) {}
    private final BaitlyExpensePayoutStore store;
    private final StripeGateway stripe;
    private final StripeConnectTransferClient client;
    private final PayoutTransferRepository transfers;
    public BaitlyExpensePayoutService(BaitlyExpensePayoutStore store, StripeGateway stripe,
            StripeConnectTransferClient client, PayoutTransferRepository transfers) {
        this.store = store; this.stripe = stripe; this.client = client; this.transfers = transfers;
    }
    public Preview preview(Long expenseId, Long orgId) {
        var beneficiary=store.beneficiary(expenseId,orgId);
        try {
            var plan = store.plan(expenseId, orgId);
            return new Preview(plan.existing() == null, null,beneficiary);
        } catch (IllegalStateException blocked) {
            return new Preview(false, blocked.getMessage(),beneficiary);
        }
    }
    public PayoutTransferDto pay(Long expenseId, Long orgId,com.clenzy.model.PayoutBeneficiary expected) throws com.stripe.exception.StripeException {
        var plan = store.plan(expenseId, orgId);
        if(expected==null || !java.util.Objects.equals(expected.userId(),plan.instruction().beneficiaryUserId())
                || !java.util.Objects.equals(expected.organizationId(),plan.instruction().beneficiaryOrganizationId()))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                    "Le bénéficiaire a changé. Vérifiez à nouveau la dépense avant de confirmer.");
        if (plan.existing() != null) return PayoutTransferDto.from(plan.existing());
        // Un transfert propriétaire annulé chez Stripe ne prouve plus la disponibilité de la retenue.
        var parent = plan.ownerTransfer();
        var proof = PayoutTransferEvidence.from(stripe.retrieveTransfer(parent.getExternalReference()), parent.getExternalReference());
        proof.verify(parent);
        client.createTransfer(plan.instruction());
        // Le journal et le statut PAID ont été enregistrés dans la même transaction.
        return transfers.findAll((root, query, cb) -> cb.and(
                cb.equal(root.get("organizationId"), orgId), cb.equal(root.get("sourceId"), expenseId),
                cb.equal(root.get("source"), com.clenzy.model.PayoutTransfer.Source.PROVIDER_EXPENSE)))
                .stream().findFirst().map(PayoutTransferDto::from)
                .orElseThrow(() -> new IllegalStateException("Le résultat du versement doit être rapproché."));
    }
}
