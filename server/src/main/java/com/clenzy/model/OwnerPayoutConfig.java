package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;

@Entity
@Table(name = "owner_payout_config",
        uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id", "owner_id"}))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class OwnerPayoutConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "payout_method", nullable = false, length = 20)
    private PayoutMethod payoutMethod = PayoutMethod.MANUAL;

    @Column(name = "stripe_connected_account_id")
    private String stripeConnectedAccountId;

    @Column(name = "stripe_onboarding_complete", nullable = false)
    private boolean stripeOnboardingComplete = false;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "iban", length = 512)
    private String iban;

    @Column(name = "bic", length = 20)
    private String bic;

    @Column(name = "bank_account_holder")
    private String bankAccountHolder;

    @Column(name = "verified", nullable = false)
    private boolean verified = false;

    /** Identifiant du recipient Wise (created via Wise API quand WISE methode active). */
    @Column(name = "wise_recipient_id", length = 64)
    private String wiseRecipientId;

    /** Profile Wise optionnel de l'owner (sinon profile Clenzy par défaut). */
    @Column(name = "wise_profile_id", length = 64)
    private String wiseProfileId;

    /** Provider Open Banking PIS utilise : GOCARDLESS ou TINK. */
    @Column(name = "open_banking_provider", length = 20)
    private String openBankingProvider;

    /** Consent ID retourne par le PIS au moment du SCA. */
    @Column(name = "open_banking_consent_id", length = 128)
    private String openBankingConsentId;

    /** Date d'expiration du consent (typiquement +90 jours). */
    @Column(name = "open_banking_consent_expires_at")
    private Instant openBankingConsentExpiresAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public PayoutMethod getPayoutMethod() { return payoutMethod; }
    public void setPayoutMethod(PayoutMethod payoutMethod) { this.payoutMethod = payoutMethod; }
    public String getStripeConnectedAccountId() { return stripeConnectedAccountId; }
    public void setStripeConnectedAccountId(String stripeConnectedAccountId) { this.stripeConnectedAccountId = stripeConnectedAccountId; }
    public boolean isStripeOnboardingComplete() { return stripeOnboardingComplete; }
    public void setStripeOnboardingComplete(boolean stripeOnboardingComplete) { this.stripeOnboardingComplete = stripeOnboardingComplete; }
    public String getIban() { return iban; }
    public void setIban(String iban) { this.iban = iban; }
    public String getBic() { return bic; }
    public void setBic(String bic) { this.bic = bic; }
    public String getBankAccountHolder() { return bankAccountHolder; }
    public void setBankAccountHolder(String bankAccountHolder) { this.bankAccountHolder = bankAccountHolder; }
    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }
    public String getWiseRecipientId() { return wiseRecipientId; }
    public void setWiseRecipientId(String wiseRecipientId) { this.wiseRecipientId = wiseRecipientId; }
    public String getWiseProfileId() { return wiseProfileId; }
    public void setWiseProfileId(String wiseProfileId) { this.wiseProfileId = wiseProfileId; }
    public String getOpenBankingProvider() { return openBankingProvider; }
    public void setOpenBankingProvider(String openBankingProvider) { this.openBankingProvider = openBankingProvider; }
    public String getOpenBankingConsentId() { return openBankingConsentId; }
    public void setOpenBankingConsentId(String openBankingConsentId) { this.openBankingConsentId = openBankingConsentId; }
    public Instant getOpenBankingConsentExpiresAt() { return openBankingConsentExpiresAt; }
    public void setOpenBankingConsentExpiresAt(Instant t) { this.openBankingConsentExpiresAt = t; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
