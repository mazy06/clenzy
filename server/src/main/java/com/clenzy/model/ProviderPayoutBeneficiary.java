package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Décision explicite et auditée : l'organisation reçoit le paiement de cette mission. */
@Entity
@Table(name = "provider_payout_beneficiaries")
@org.hibernate.annotations.Immutable
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ProviderPayoutBeneficiary {
    @Id @Column(name = "intervention_id") private Long interventionId;
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(name = "beneficiary_organization_id", nullable = false) private Long beneficiaryOrganizationId;
    @Column(name = "assigned_user_id") private Long assignedUserId;
    @Column(name = "team_id") private Long teamId;
    @Column(name = "selected_by_user_id", nullable = false) private Long selectedByUserId;
    @Column(name = "selected_at", nullable = false) private Instant selectedAt;

    protected ProviderPayoutBeneficiary() {}
    public ProviderPayoutBeneficiary(Long missionId, Long orgId, Long recipientOrgId, Long assignedUserId,
            Long teamId, Long actorId) {
        this.interventionId = missionId;
        this.organizationId = orgId;
        this.beneficiaryOrganizationId = recipientOrgId;
        this.assignedUserId = assignedUserId;
        this.teamId = teamId;
        this.selectedByUserId = actorId;
        this.selectedAt = Instant.now();
    }
    public Long getInterventionId() { return interventionId; }
    public Long getOrganizationId() { return organizationId; }
    public Long getBeneficiaryOrganizationId() { return beneficiaryOrganizationId; }
    public Long getAssignedUserId() { return assignedUserId; }
    public Long getTeamId() { return teamId; }
    public Long getSelectedByUserId() { return selectedByUserId; }
    public Instant getSelectedAt() { return selectedAt; }
}
