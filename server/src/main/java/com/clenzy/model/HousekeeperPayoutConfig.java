package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Compte Stripe Connect Express d'un prestataire ménage (Moteur Ménage 3B — P9).
 *
 * <p>Miroir volontaire d'{@link OwnerPayoutConfig} (SRP) : le flux propriétaires
 * porte des champs qui n'ont aucun sens pour un pro (SEPA, Wise, payoutMethod…)
 * et toute généralisation risquerait une régression du money-path owners.
 * L'onboarding pro est EMBARQUÉ (Account Sessions), pas un AccountLink redirect.</p>
 */
@Entity
@Table(name = "housekeeper_payout_configs",
       uniqueConstraints = @UniqueConstraint(name = "housekeeper_payout_configs_user_org_unique",
                                             columnNames = {"user_id", "organization_id"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class HousekeeperPayoutConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Le prestataire (users.id). */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "stripe_account_id", length = 64)
    private String stripeAccountId;

    /** Vrai quand Stripe confirme charges+payouts enabled (webhook account.updated / refresh). */
    @Column(name = "onboarding_completed", nullable = false)
    private boolean onboardingCompleted;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getStripeAccountId() { return stripeAccountId; }
    public void setStripeAccountId(String stripeAccountId) { this.stripeAccountId = stripeAccountId; }

    public boolean isOnboardingCompleted() { return onboardingCompleted; }
    public void setOnboardingCompleted(boolean onboardingCompleted) { this.onboardingCompleted = onboardingCompleted; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
