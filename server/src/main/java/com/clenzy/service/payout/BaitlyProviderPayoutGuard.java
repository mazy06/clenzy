package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.HousekeeperPayoutRecordRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Objects;

/** Validation du financement et de son montant sous le verrou partagé avec les remboursements. */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class BaitlyProviderPayoutGuard {
    private final EntityManager em;
    private final ProviderPayoutBeneficiaryService beneficiaries;
    private final ProviderPayoutPolicy policy;
    private final HousekeeperPayoutRecordRepository records;

    public BaitlyProviderPayoutGuard(EntityManager em, ProviderPayoutBeneficiaryService beneficiaries,
            ProviderPayoutPolicy policy, HousekeeperPayoutRecordRepository records) {
        this.em = em; this.beneficiaries = beneficiaries; this.policy = policy; this.records = records;
    }

    public void requireFunding(Long missionId, Long orgId, PayoutBeneficiary beneficiary, BigDecimal net, BigDecimal commission) {
        beneficiaries.lockAndRequireRecipient(missionId, orgId, beneficiary);
        var mission = em.find(Intervention.class, missionId);
        require(mission != null && Objects.equals(orgId, mission.getOrganizationId()), "Mission hors organisation.");
        // Le lock advisory protège le bénéficiaire ; le verrou de ligne protège le financement.
        em.refresh(mission, LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(orgId, mission.getOrganizationId()), "Mission hors organisation.");
        if (mission.getServiceRequest() != null) em.refresh(mission.getServiceRequest());
        String reason = policy.blockingReason(mission);
        require(reason == null, "Financement à rapprocher avant versement : " + reason);
        BigDecimal gross = policy.payableGross(mission);
        require(net != null && commission != null && net.signum() > 0 && commission.signum() >= 0
                && gross != null && net.add(commission).compareTo(gross) == 0,
                "Le montant du versement ne correspond plus au solde conservé après remboursement.");
    }

    public void requireInstruction(PayoutTransferInstruction instruction) {
        var record = records.findByInterventionId(instruction.sourceId())
                .orElseThrow(() -> new IllegalStateException("Versement prestataire non préparé."));
        require(Objects.equals(record.getOrganizationId(), instruction.organizationId())
                && record.beneficiary().equals(new PayoutBeneficiary(instruction.beneficiaryUserId(), instruction.beneficiaryOrganizationId()))
                && record.getStatus() == HousekeeperPayoutRecord.Status.PENDING
                && record.getStripeTransferId() == null && "EUR".equals(instruction.currency())
                && record.getAmount().compareTo(instruction.amount()) == 0,
                "Le versement préparé doit être rapproché.");
        requireFunding(record.getInterventionId(), record.getOrganizationId(), record.beneficiary(),
                record.getAmount(), record.getCommissionAmount());
        record = lockRecord(record);
        require(record.getStatus() == HousekeeperPayoutRecord.Status.PENDING && record.getStripeTransferId() == null
                && record.getAmount().compareTo(instruction.amount()) == 0, "Le versement préparé a changé.");
    }

    public HousekeeperPayoutRecord lockRecord(HousekeeperPayoutRecord before) {
        var current = records.lockForReconciliation(before.getInterventionId(), before.getOrganizationId()).orElseThrow();
        em.refresh(current, LockModeType.PESSIMISTIC_WRITE);
        return current;
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException(message);
    }
}
