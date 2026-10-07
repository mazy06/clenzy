package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

/** Dernière validation Baitly, dans la transaction qui réserve l'instruction PSP. */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class BaitlyOwnerPayoutGuard {
    private final EntityManager em;
    private final OwnerPayoutRepository payouts;
    private final OwnerPayoutReservationRepository claims;
    private final OwnerPayoutConfigRepository configs;
    private final OwnerPayoutFundingService funding;

    public BaitlyOwnerPayoutGuard(EntityManager em, OwnerPayoutRepository payouts,
            OwnerPayoutReservationRepository claims, OwnerPayoutConfigRepository configs,
            OwnerPayoutFundingService funding) {
        this.em = em; this.payouts = payouts; this.claims = claims; this.configs = configs; this.funding = funding;
    }

    public void requireInstruction(PayoutTransferInstruction instruction) {
        var payout = payouts.lockForReconciliation(instruction.sourceId(), instruction.organizationId())
                .orElseThrow(() -> new IllegalStateException("Reversement propriétaire introuvable."));
        em.refresh(payout, LockModeType.PESSIMISTIC_WRITE);
        require(instruction.source() == PayoutTransfer.Source.OWNER_PAYOUT
                && Objects.equals(payout.getOrganizationId(), instruction.organizationId())
                && Objects.equals(payout.getOwnerId(), instruction.beneficiaryUserId())
                && instruction.beneficiaryOrganizationId() == null
                && payout.getStatus() == OwnerPayout.PayoutStatus.PROCESSING
                && payout.getPayoutMethod() == PayoutMethod.STRIPE_CONNECT
                && payout.getStripeTransferId() == null && payout.getPaymentReference() == null
                && payout.getNetAmount() != null && payout.getNetAmount().compareTo(instruction.amount()) == 0
                && instruction.currency().equals(payout.getCurrency()), "Le reversement préparé a changé.");

        // Même verrou que l'annulation publique et la réserve de remboursement gestionnaire.
        var lines = claims.findByPayoutIdAndOrganizationId(payout.getId(), payout.getOrganizationId());
        require(!lines.isEmpty(), "Encaissements du reversement absents.");
        for (Long id : lines.stream().map(OwnerPayoutReservation::getReservationId).sorted().distinct().toList()) {
            var stay = em.find(Reservation.class, id);
            require(stay != null && Objects.equals(stay.getOrganizationId(), instruction.organizationId()),
                    "Séjour hors organisation.");
            em.refresh(stay, LockModeType.PESSIMISTIC_WRITE);
            require(stay.getProperty() != null, "Logement du séjour absent.");
            em.refresh(stay.getProperty(), LockModeType.PESSIMISTIC_WRITE);
        }
        // Les entités chargées par un précontrôle ne doivent pas masquer un événement plus récent.
        funding.validateFresh(payout);
        var config = configs.findByOwnerIdAndOrgId(payout.getOwnerId(), payout.getOrganizationId())
                .orElseThrow(() -> new IllegalStateException("Compte de versement absent."));
        em.refresh(config, LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(config.getOrganizationId(), instruction.organizationId())
                && Objects.equals(config.getOwnerId(), instruction.beneficiaryUserId())
                && config.isVerified() && config.getPayoutMethod() == PayoutMethod.STRIPE_CONNECT
                && Objects.equals(config.getStripeConnectedAccountId(), instruction.destination()),
                "Le compte de versement du propriétaire a changé.");
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException(message);
    }
}
