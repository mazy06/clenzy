package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Objects;

/** Réserve une dépense déjà retenue sur des encaissements prouvés. Aucun appel réseau. */
@Service
@Transactional
public class BaitlyExpensePayoutStore {
    public record Plan(PayoutTransferInstruction instruction, PayoutTransfer ownerTransfer, PayoutTransfer existing) {}
    private final ProviderExpenseRepository expenses;
    private final PayoutTransferRepository transfers;
    private final PaymentConnectionRepository connections;
    private final OwnerPayoutFundingService funding;
    private final OwnerPayoutReservationRepository claims;
    private final EntityManager em;
    private final BaitlyExpenseBeneficiaryService beneficiaries;

    public BaitlyExpensePayoutStore(ProviderExpenseRepository expenses, PayoutTransferRepository transfers,
            PaymentConnectionRepository connections, OwnerPayoutFundingService funding,
            OwnerPayoutReservationRepository claims, EntityManager em,BaitlyExpenseBeneficiaryService beneficiaries) {
        this.expenses = expenses; this.transfers = transfers; this.connections = connections;
        this.funding = funding; this.claims = claims; this.em = em; this.beneficiaries=beneficiaries;
    }
    public BaitlyExpenseBeneficiaryService.Choice beneficiary(Long id,Long org) { return beneficiaries.choice(id,org); }

    public Plan plan(Long id, Long orgId) {
        var expense = expenses.findByIdAndOrgId(id, orgId)
                .orElseThrow(() -> new com.clenzy.exception.NotFoundException("Dépense introuvable."));
        var known = transfers.lockBySource(orgId, PayoutTransfer.Source.PROVIDER_EXPENSE, id);
        if (known.isPresent()) {
            var transfer = known.get();
            requireSameExpense(expense, transfer);
            if (transfer.getState() != PayoutTransfer.State.TRANSFERRED)
                throw new PayoutReconciliationRequiredException("Le versement de cette dépense est à rapprocher dans le suivi des versements.", transfer.getExternalReference(), null);
            require(expense.getStatus() == ExpenseStatus.PAID && Objects.equals(expense.getPaymentReference(), transfer.getExternalReference()),
                    "La preuve du règlement doit être rapprochée.");
            return new Plan(instruction(transfer), null, transfer);
        }
        require(expense.getOwnerPayout() != null, "Cette dépense doit d’abord être retenue sur un reversement propriétaire financé.");
        var payout = expense.getOwnerPayout();
        em.refresh(payout, LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(payout.getOrganizationId(), orgId) && payout.getStatus() == OwnerPayout.PayoutStatus.PAID
                && payout.getPayoutMethod() == PayoutMethod.STRIPE_CONNECT && payout.getFundingVersion() == 1,
                "Le reversement propriétaire doit être confirmé par Stripe avant le paiement de la dépense.");
        var ownerTransfer = transfers.lockBySource(orgId, PayoutTransfer.Source.OWNER_PAYOUT, payout.getId())
                .orElseThrow(() -> new IllegalStateException("Preuve du reversement propriétaire absente."));
        require(ownerTransfer.getState() == PayoutTransfer.State.TRANSFERRED
                && Objects.equals(ownerTransfer.getBeneficiaryUserId(), payout.getOwnerId())
                && ownerTransfer.getBeneficiaryOrganizationId() == null
                && ownerTransfer.getAmount().compareTo(payout.getNetAmount()) == 0
                && ownerTransfer.getCurrency().equals(payout.getCurrency())
                && Objects.equals(ownerTransfer.getExternalReference(), payout.getStripeTransferId())
                && Objects.equals(ownerTransfer.getExternalReference(), payout.getPaymentReference()),
                "La retenue n’est pas justifiée par le transfert propriétaire.");
        for (var line : claims.findByPayoutIdAndOrganizationId(payout.getId(), orgId).stream()
                .sorted(java.util.Comparator.comparing(OwnerPayoutReservation::getReservationId)).toList()) {
            var stay = em.find(Reservation.class, line.getReservationId());
            require(stay != null && Objects.equals(stay.getOrganizationId(), orgId), "Séjour hors organisation.");
            em.refresh(stay, LockModeType.PESSIMISTIC_WRITE);
        }
        funding.validateFresh(payout);
        em.refresh(expense, LockModeType.PESSIMISTIC_WRITE);
        require(expense.getStatus() == ExpenseStatus.INCLUDED && expense.getPaymentReference() == null
                && expense.getOwnerPayout() != null && Objects.equals(expense.getOwnerPayout().getId(), payout.getId())
                && expense.getProvider() != null && "EUR".equals(expense.getCurrency()),
                "Dépense déjà réglée, modifiée ou devise non prise en charge.");
        var beneficiary=beneficiaries.resolve(expense);
        var account = (beneficiary.organizationId()==null?connections.findExpenseProviderAccount(id, orgId):connections.findExpenseCompanyAccount(id,orgId))
                .orElseThrow(() -> new IllegalStateException(beneficiary.organizationId()==null
                        ?"Le prestataire doit connecter son compte personnel de versement.":"La société doit connecter son compte de versement."));
        require(account.getReady(), "Le compte de versement du prestataire n’est pas prêt.");
        return new Plan(new PayoutTransferInstruction(orgId, PayoutTransfer.Source.PROVIDER_EXPENSE, id,
                beneficiary.userId(),beneficiary.organizationId(), expense.getAmountTtc(), expense.getCurrency(), account.getAccountId(),
                "Règlement dépense #" + id), ownerTransfer, null);
    }

    /** Dernière vérification dans la transaction du journal, après le précontrôle PSP. */
    public void requireInstruction(PayoutTransferInstruction instruction) {
        var plan = plan(instruction.sourceId(), instruction.organizationId());
        require(plan.existing() == null && plan.instruction().equals(instruction), "La dépense ou son destinataire a changé.");
    }

    /** Journal et dépense basculent ensemble uniquement après preuve PSP, y compris au rapprochement. */
    public void settle(PayoutTransfer transfer) {
        if (transfer.getSource() != PayoutTransfer.Source.PROVIDER_EXPENSE) return;
        var expense = expenses.findByIdAndOrgId(transfer.getSourceId(), transfer.getOrganizationId())
                .orElseThrow(() -> new IllegalStateException("Dépense du transfert introuvable."));
        em.refresh(expense, LockModeType.PESSIMISTIC_WRITE);
        requireSameExpense(expense, transfer);
        require(transfer.getState() == PayoutTransfer.State.TRANSFERRED && transfer.getExternalReference() != null
                && (expense.getStatus() == ExpenseStatus.INCLUDED || expense.getStatus() == ExpenseStatus.PAID)
                && (expense.getPaymentReference() == null || expense.getPaymentReference().equals(transfer.getExternalReference())),
                "Preuve de règlement incompatible avec la dépense.");
        expense.setStatus(ExpenseStatus.PAID);
        expense.setPaymentReference(transfer.getExternalReference());
        expenses.saveAndFlush(expense);
    }

    private void requireSameExpense(ProviderExpense expense, PayoutTransfer transfer) {
        var beneficiary=beneficiaries.resolve(expense);
        require(Objects.equals(expense.getOrganizationId(), transfer.getOrganizationId()) && expense.getProvider() != null
                && Objects.equals(beneficiary.userId(), transfer.getBeneficiaryUserId())
                && Objects.equals(beneficiary.organizationId(),transfer.getBeneficiaryOrganizationId()) && expense.getAmountTtc().compareTo(transfer.getAmount()) == 0
                && expense.getCurrency().equals(transfer.getCurrency()), "La dépense diffère de l’instruction initiale.");
    }
    private static PayoutTransferInstruction instruction(PayoutTransfer t) {
        return new PayoutTransferInstruction(t.getOrganizationId(), t.getSource(), t.getSourceId(), t.getBeneficiaryUserId(),
                t.getBeneficiaryOrganizationId(),t.getAmount(), t.getCurrency(), t.getDestination(), t.getDescription());
    }
    private static void require(boolean condition, String message) { if (!condition) throw new IllegalStateException(message); }
}
