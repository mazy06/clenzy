package com.clenzy.service.payout;

import com.clenzy.dto.PayoutTransferDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Objects;

/** Journal, état métier et auteur sont confirmés atomiquement sous verrou ; aucun HTTP dans cette transaction. */
@Service
public class PayoutReconciliationWriter {
    private final PayoutTransferRepository transfers;
    private final PayoutTransferEventRepository events;
    private final OwnerPayoutRepository owners;
    private final HousekeeperPayoutRecordRepository providers;
    private final BaitlyOwnerPayoutDocuments documents;
    private final BaitlyExpensePayoutStore expenses;
    public PayoutReconciliationWriter(PayoutTransferRepository transfers, PayoutTransferEventRepository events,
            OwnerPayoutRepository owners, HousekeeperPayoutRecordRepository providers, BaitlyOwnerPayoutDocuments documents,
            BaitlyExpensePayoutStore expenses) {
        this.transfers = transfers; this.events = events; this.owners = owners; this.providers = providers;
        this.documents = documents;
        this.expenses = expenses;
    }
    @Transactional
    public PayoutTransferDto confirm(Long orgId, Long id, PayoutTransferEvidence proof, String actor) {
        var transfer = transfers.lockByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Transfert introuvable dans cette organisation."));
        PayoutReconciliationService.requireReconcilable(transfer);
        proof.verify(transfer);
        // Une confirmation répétée ne crée ni événement ni écriture financière supplémentaires.
        if (transfer.getState() == PayoutTransfer.State.TRANSFERRED) return PayoutTransferDto.from(transfer);
        if (transfer.getSource() == PayoutTransfer.Source.OWNER_PAYOUT) reconcileOwner(transfer, proof);
        else if (transfer.getSource() == PayoutTransfer.Source.INTERVENTION) reconcileProvider(transfer, proof);
        transfer.captureDestinationPayment(proof.destinationPayment(), proof.livemode());
        transfer.transferred(proof.reference());
        documents.settle(transfer);
        expenses.settle(transfer);
        transfers.saveAndFlush(transfer);
        events.save(PayoutTransferEvent.reconciled(transfer, actor));
        return PayoutTransferDto.from(transfer);
    }
    private void reconcileOwner(PayoutTransfer transfer, PayoutTransferEvidence proof) {
        var payout = owners.lockForReconciliation(transfer.getSourceId(), transfer.getOrganizationId())
                .orElseThrow(PayoutTransferEvidence::conflict);
        if (!Objects.equals(payout.getOwnerId(), transfer.getBeneficiaryUserId())
                || transfer.getBeneficiaryOrganizationId() != null
                || payout.getNetAmount().compareTo(transfer.getAmount()) != 0
                || !payout.getCurrency().equalsIgnoreCase(transfer.getCurrency())
                || payout.getPayoutMethod() != PayoutMethod.STRIPE_CONNECT
                || !(payout.getStatus() == OwnerPayout.PayoutStatus.PROCESSING
                    || payout.getStatus() == OwnerPayout.PayoutStatus.FAILED || payout.getStatus() == OwnerPayout.PayoutStatus.PAID)
                || different(payout.getStripeTransferId(), proof.reference())
                || different(payout.getPaymentReference(), proof.reference())
                || (payout.getStatus() == OwnerPayout.PayoutStatus.PAID && !proof.reference().equals(payout.getStripeTransferId()))) {
            throw PayoutTransferEvidence.conflict();
        }
        payout.setStripeTransferId(proof.reference()); payout.setPaymentReference(proof.reference());
        // PAID est le statut métier historique du transfert Connect, pas la réception bancaire.
        payout.setStatus(OwnerPayout.PayoutStatus.PAID); payout.setPaidAt(proof.createdAt()); payout.setFailureReason(null);
        owners.save(payout);
    }
    private void reconcileProvider(PayoutTransfer transfer, PayoutTransferEvidence proof) {
        var payout = providers.lockForReconciliation(transfer.getSourceId(), transfer.getOrganizationId())
                .orElseThrow(PayoutTransferEvidence::conflict);
        if (!Objects.equals(payout.getUserId(), transfer.getBeneficiaryUserId())
                || !Objects.equals(payout.getBeneficiaryOrganizationId(), transfer.getBeneficiaryOrganizationId())
                || payout.getAmount().compareTo(transfer.getAmount()) != 0
                || different(payout.getStripeTransferId(), proof.reference())
                || (payout.getStatus() == HousekeeperPayoutRecord.Status.SENT && !proof.reference().equals(payout.getStripeTransferId()))) {
            throw PayoutTransferEvidence.conflict();
        }
        payout.setStripeTransferId(proof.reference()); payout.setStatus(HousekeeperPayoutRecord.Status.SENT); payout.setFailureReason(null);
        providers.save(payout);
    }
    private boolean different(String existing, String reference) { return existing != null && !existing.equals(reference); }
}
