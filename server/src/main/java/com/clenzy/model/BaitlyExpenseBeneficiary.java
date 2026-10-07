package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Désignation explicite de la société créancière, indépendante de la mission. */
@Entity @Table(name="baitly_expense_beneficiaries")
@org.hibernate.annotations.Immutable
@org.hibernate.annotations.Filter(name="organizationFilter",condition="organization_id = :orgId")
public class BaitlyExpenseBeneficiary {
    @Id @Column(name="expense_id") private Long expenseId;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="provider_id",nullable=false) private Long providerId;
    @Column(name="beneficiary_organization_id",nullable=false) private Long beneficiaryOrganizationId;
    @Column(name="selected_by_user_id",nullable=false) private Long selectedByUserId;
    @Column(name="selected_at",nullable=false) private Instant selectedAt;
    protected BaitlyExpenseBeneficiary() {}
    public BaitlyExpenseBeneficiary(ProviderExpense expense,Long organization,Long actor) {
        expenseId=expense.getId(); organizationId=expense.getOrganizationId(); providerId=expense.getProvider().getId();
        beneficiaryOrganizationId=organization; selectedByUserId=actor; selectedAt=Instant.now();
    }
    public Long getExpenseId() { return expenseId; }
    public Long getOrganizationId() { return organizationId; }
    public Long getProviderId() { return providerId; }
    public Long getBeneficiaryOrganizationId() { return beneficiaryOrganizationId; }
    public Instant getSelectedAt() { return selectedAt; }
}
