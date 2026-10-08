package com.clenzy.service.payout;

import com.clenzy.model.PayoutTransfer;
import com.clenzy.model.PayoutTransferEvent;
import com.clenzy.repository.PayoutTransferRepository;
import com.clenzy.repository.PayoutTransferEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;

/** Transactions courtes ; aucune connexion PSP ni réécriture de solde comptable historique. */
@Service
@Transactional(propagation = Propagation.REQUIRES_NEW)
public class PayoutTransferJournal {
    private final PayoutTransferRepository transfers;
    private final PayoutTransferEventRepository events;
    private final BaitlyProviderPayoutGuard providerGuard;
    private final BaitlyOwnerPayoutGuard ownerGuard;
    private final BaitlyOwnerPayoutDocuments documents;
    private final BaitlyExpensePayoutStore expenses;
    private final BaitlyCommercePayoutStore commerce;
    public PayoutTransferJournal(PayoutTransferRepository transfers, PayoutTransferEventRepository events,
            BaitlyProviderPayoutGuard providerGuard, BaitlyOwnerPayoutGuard ownerGuard, BaitlyOwnerPayoutDocuments documents,
            BaitlyExpensePayoutStore expenses, BaitlyCommercePayoutStore commerce) {
        this.transfers = transfers; this.events = events;
        this.providerGuard = providerGuard;
        this.ownerGuard = ownerGuard;
        this.documents = documents;
        this.expenses = expenses;
        this.commerce = commerce;
    }

    /** Lecture avant précontrôle PSP. prepare reste l'arbitre atomique après ce contrôle. */
    public Optional<String> previous(PayoutTransferInstruction instruction) {
        return transfers.lockBySource(instruction.organizationId(), instruction.source(), instruction.sourceId())
                .map(transfer -> {
                    checkMatching(instruction, transfer);
                    if (transfer.getState() != PayoutTransfer.State.TRANSFERRED) throw reconciliation(null);
                    return transfer.getExternalReference();
                });
    }

    /** Vide = cet appel possède l'émission ; sinon la référence déjà obtenue, sans nouvel appel PSP. */
    public Optional<String> prepare(PayoutTransferInstruction instruction) {
        var known = previous(instruction);
        if (known.isPresent()) return known;
        if (instruction.source() == PayoutTransfer.Source.INTERVENTION) {
            try { providerGuard.requireInstruction(instruction); }
            catch (IllegalStateException changed) {
                throw new PayoutFundsUnavailableException("Financement du solde à rapprocher. Aucun transfert émis. " + changed.getMessage(), changed);
            }
        }
        if (instruction.source() == PayoutTransfer.Source.OWNER_PAYOUT) {
            try { ownerGuard.requireInstruction(instruction); }
            catch (IllegalStateException changed) {
                throw new PayoutFundsUnavailableException("Financement propriétaire à rapprocher. Aucun transfert émis. " + changed.getMessage(), changed);
            }
        }
        if (instruction.source() == PayoutTransfer.Source.PROVIDER_EXPENSE) expenses.requireInstruction(instruction);
        if (instruction.source() == PayoutTransfer.Source.COMMERCE) commerce.requireInstruction(instruction);
        int inserted = transfers.insertIfAbsent(instruction.organizationId(), instruction.source().name(),
                instruction.sourceId(), instruction.beneficiaryUserId(), instruction.beneficiaryOrganizationId(), instruction.amount(), instruction.currency(),
                instruction.destination(), instruction.description(), instruction.idempotencyKey());
        PayoutTransfer transfer = requireMatching(instruction);
        if (inserted == 1) {
            events.save(new PayoutTransferEvent(transfer));
            return Optional.empty();
        }
        if (transfer.getState() == PayoutTransfer.State.TRANSFERRED) return Optional.of(transfer.getExternalReference());
        throw reconciliation(null);
    }

    public void transferred(PayoutTransferInstruction instruction, String reference) {
        transferred(instruction, reference, null, null);
    }

    public void transferred(PayoutTransferInstruction instruction, String reference, String destinationPayment, Boolean livemode) {
        if (reference == null || reference.isBlank()) throw reconciliation(null);
        PayoutTransfer transfer = requireMatching(instruction);
        transfer.captureDestinationPayment(destinationPayment, livemode);
        if (transfer.getState() == PayoutTransfer.State.TRANSFERRED) {
            if (!reference.equals(transfer.getExternalReference())) throw reconciliation(null);
            return;
        }
        transfer.transferred(reference);
        documents.settle(transfer);
        expenses.settle(transfer);
        commerce.settle(transfer);
        transfers.saveAndFlush(transfer);
        events.save(new PayoutTransferEvent(transfer));
    }

    public void uncertain(PayoutTransferInstruction instruction) {
        PayoutTransfer transfer = requireMatching(instruction);
        if (transfer.getState() != PayoutTransfer.State.SUBMITTING) return;
        transfer.requireReconciliation();
        transfers.save(transfer);
        events.save(new PayoutTransferEvent(transfer));
    }

    /** Interdit de contourner une tentative Stripe en changeant simplement de rail de versement. */
    public void checkOwnerRoute(Long orgId, Long payoutId, com.clenzy.model.PayoutMethod method) {
        transfers.lockBySource(orgId, PayoutTransfer.Source.OWNER_PAYOUT, payoutId).ifPresent(transfer -> {
            if (method != com.clenzy.model.PayoutMethod.STRIPE_CONNECT
                    || transfer.getState() != PayoutTransfer.State.TRANSFERRED) throw reconciliation(null);
        });
    }

    private PayoutTransfer requireMatching(PayoutTransferInstruction instruction) {
        PayoutTransfer transfer = transfers.lockBySource(instruction.organizationId(), instruction.source(), instruction.sourceId())
                .orElseThrow(() -> reconciliation(null));
        checkMatching(instruction, transfer);
        return transfer;
    }

    private void checkMatching(PayoutTransferInstruction instruction, PayoutTransfer transfer) {
        if (!instruction.matches(transfer)) {
            throw new PayoutReconciliationRequiredException(
                    "Le montant, la devise ou le bénéficiaire diffère du transfert initial. Rapprochement requis.",
                    transfer.getExternalReference(), null);
        }
    }

    private PayoutReconciliationRequiredException reconciliation(Throwable cause) {
        return new PayoutReconciliationRequiredException(
                "Un transfert est déjà en cours ou son résultat reste incertain. Vérifiez-le auprès du PSP avant toute relance.",
                null, cause);
    }
}
