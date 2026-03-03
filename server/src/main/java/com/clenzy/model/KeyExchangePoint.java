package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "key_exchange_points", indexes = {
    @Index(name = "idx_kep_org", columnList = "organization_id"),
    @Index(name = "idx_kep_user", columnList = "user_id"),
    @Index(name = "idx_kep_property", columnList = "property_id"),
    @Index(name = "idx_kep_provider", columnList = "provider"),
    @Index(name = "idx_kep_status", columnList = "status"),
    @Index(name = "idx_kep_token", columnList = "verification_token")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class KeyExchangePoint {

    // ─── Enums ──────────────────────────────────────────────────

    public enum Provider {
        KEYNEST, CLENZY_KEYVAULT
    }

    public enum PointStatus {
        ACTIVE, INACTIVE
    }

    public enum GuardianType {
        /** Commerçant (tabac, boulangerie, etc.) */
        MERCHANT,
        /** Particulier (voisin, gardien d'immeuble, etc.) */
        INDIVIDUAL
    }

    // ─── Fields ─────────────────────────────────────────────────

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 20)
    private Provider provider;

    @Enumerated(EnumType.STRING)
    @Column(name = "guardian_type", length = 20)
    private GuardianType guardianType;

    @Column(name = "provider_store_id", length = 100)
    private String providerStoreId;

    @Column(name = "store_name", nullable = false)
    private String storeName;

    @Column(name = "store_address", columnDefinition = "TEXT")
    private String storeAddress;

    @Column(name = "store_phone", length = 50)
    private String storePhone;

    @Column(name = "store_lat")
    private Double storeLat;

    @Column(name = "store_lng")
    private Double storeLng;

    @Column(name = "store_opening_hours", columnDefinition = "TEXT")
    private String storeOpeningHours;

    @Column(name = "verification_token", length = 100)
    private String verificationToken;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PointStatus status = PointStatus.ACTIVE;

    @Column(name = "config_json", columnDefinition = "TEXT")
    private String configJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // ─── Relations ──────────────────────────────────────────────

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", insertable = false, updatable = false)
    private Property property;

    // ─── Lifecycle ──────────────────────────────────────────────

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ─── Getters / Setters ──────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }

    public GuardianType getGuardianType() { return guardianType; }
    public void setGuardianType(GuardianType guardianType) { this.guardianType = guardianType; }

    public String getProviderStoreId() { return providerStoreId; }
    public void setProviderStoreId(String providerStoreId) { this.providerStoreId = providerStoreId; }

    public String getStoreName() { return storeName; }
    public void setStoreName(String storeName) { this.storeName = storeName; }

    public String getStoreAddress() { return storeAddress; }
    public void setStoreAddress(String storeAddress) { this.storeAddress = storeAddress; }

    public String getStorePhone() { return storePhone; }
    public void setStorePhone(String storePhone) { this.storePhone = storePhone; }

    public Double getStoreLat() { return storeLat; }
    public void setStoreLat(Double storeLat) { this.storeLat = storeLat; }

    public Double getStoreLng() { return storeLng; }
    public void setStoreLng(Double storeLng) { this.storeLng = storeLng; }

    public String getStoreOpeningHours() { return storeOpeningHours; }
    public void setStoreOpeningHours(String storeOpeningHours) { this.storeOpeningHours = storeOpeningHours; }

    public String getVerificationToken() { return verificationToken; }
    public void setVerificationToken(String verificationToken) { this.verificationToken = verificationToken; }

    public PointStatus getStatus() { return status; }
    public void setStatus(PointStatus status) { this.status = status; }

    public String getConfigJson() { return configJson; }
    public void setConfigJson(String configJson) { this.configJson = configJson; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public Property getProperty() { return property; }
}
