package com.clenzy.dto.keyexchange;

import java.time.LocalDateTime;

public class KeyExchangePointDto {

    private Long id;
    private Long propertyId;
    private String propertyName;
    private String provider;
    private String guardianType;
    private String providerStoreId;
    private String storeName;
    private String storeAddress;
    private String storePhone;
    private Double storeLat;
    private Double storeLng;
    private String storeOpeningHours;
    private String verificationToken;
    private String status;
    private long activeCodesCount;
    private LocalDateTime createdAt;

    // ─── Getters / Setters ──────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getGuardianType() { return guardianType; }
    public void setGuardianType(String guardianType) { this.guardianType = guardianType; }

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

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public long getActiveCodesCount() { return activeCodesCount; }
    public void setActiveCodesCount(long activeCodesCount) { this.activeCodesCount = activeCodesCount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
