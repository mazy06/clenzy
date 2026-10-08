package com.clenzy.model;

import jakarta.persistence.*;

/** Verrou commun des crédits d'une organisation et dépassements réellement consommés. */
@Entity
@Table(name = "baitly_ai_credit_accounts")
public class BaitlyCreditAccount {
    @Id @Column(name = "organization_id")
    private Long organizationId;
    @Column(name = "overdraft_millicredits", nullable = false)
    private long overdraftMillicredits;
    public Long getOrganizationId() { return organizationId; }
    public long getOverdraftMillicredits() { return overdraftMillicredits; }
    public void addOverdraft(long amount) {
        if (amount < 0) throw new IllegalArgumentException("Dépassement négatif");
        overdraftMillicredits = Math.addExact(overdraftMillicredits, amount);
    }
}
