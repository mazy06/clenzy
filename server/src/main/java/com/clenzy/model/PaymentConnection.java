package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Payment account owned by a beneficiary, independently of the administrator who onboards it. */
@Entity
@Table(name = "payment_connections", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"organization_id", "beneficiary_key"}),
    @UniqueConstraint(columnNames = {"provider", "provider_account_id"})
})
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PaymentConnection {
    @Id private UUID id = UUID.randomUUID();
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(name = "beneficiary_key", nullable = false, length = 80) private String beneficiaryKey;
    @Column(name = "user_id") private Long userId;
    @Column(nullable = false, length = 2) private String country;
    @Column(nullable = false, length = 24) private String provider = "STRIPE";
    @Column(name = "provider_account_id", length = 128) private String providerAccountId;
    @Column(name = "charges_enabled", nullable = false) private boolean chargesEnabled;
    @Column(name = "payouts_enabled", nullable = false) private boolean payoutsEnabled;
    @Column(name = "transfers_enabled", nullable = false) private boolean transfersEnabled;
    @Column(name = "details_submitted", nullable = false) private boolean detailsSubmitted;
    @Column(nullable = false) private boolean authorized = true;
    @Column(name = "checked_at") private Instant checkedAt;
    @Version private long version;

    public UUID getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long value) { organizationId = value; }
    public String getBeneficiaryKey() { return beneficiaryKey; }
    public void setBeneficiaryKey(String value) { beneficiaryKey = value; }
    public Long getUserId() { return userId; }
    public void setUserId(Long value) { userId = value; }
    public String getCountry() { return country; }
    public void setCountry(String value) { country = value; }
    public String getProvider() { return provider; }
    public String getProviderAccountId() { return providerAccountId; }
    public void setProviderAccountId(String value) { providerAccountId = value; }
    public boolean isChargesEnabled() { return chargesEnabled; }
    public boolean isPayoutsEnabled() { return payoutsEnabled; }
    public boolean isTransfersEnabled() { return transfersEnabled; }
    public boolean isDetailsSubmitted() { return detailsSubmitted; }
    public Instant getCheckedAt() { return checkedAt; }
    public boolean isAuthorized() { return authorized; }
    public void setAuthorized(boolean value) { authorized = value; }
    public boolean isReady() { return authorized && detailsSubmitted && payoutsEnabled && transfersEnabled; }
    public void updateCapabilities(boolean charges, boolean payouts, boolean transfers, boolean details) {
        chargesEnabled = charges;
        payoutsEnabled = payouts;
        transfersEnabled = transfers;
        detailsSubmitted = details;
        checkedAt = Instant.now();
    }
}
