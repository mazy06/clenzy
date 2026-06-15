package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Solde de crédit fidélité d'un voyageur (2.8 phase 2b), par (organisation, email). Le solde est en
 * CENTIMES ({@code balance_cents}) pour permettre une déduction atomique (UPDATE conditionnel, anti
 * double-dépense — audit #8) à la rédemption. Le détail des écritures vit dans
 * {@link GuestCreditTransaction}.
 */
@Entity
@Table(name = "guest_credit_accounts",
    uniqueConstraints = @UniqueConstraint(name = "uq_guest_credit_account", columnNames = {"organization_id", "email"}))
public class GuestCreditAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "balance_cents", nullable = false)
    private long balanceCents = 0;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "EUR";

    /** Parrainage (2.11) : code de parrainage stable du voyageur, généré à la demande, unique par org. */
    @Column(name = "referral_code", length = 32)
    private String referralCode;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public long getBalanceCents() { return balanceCents; }
    public void setBalanceCents(long balanceCents) { this.balanceCents = balanceCents; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getReferralCode() { return referralCode; }
    public void setReferralCode(String referralCode) { this.referralCode = referralCode; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
