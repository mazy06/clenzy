package com.clenzy.dto.keyexchange;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class CreateKeyExchangePointDto {

    @NotNull(message = "La propriete est requise")
    private Long propertyId;

    @NotBlank(message = "Le provider est requis (KEYNEST ou CLENZY_KEYVAULT)")
    private String provider;

    /** ID externe du store KeyNest (requis uniquement pour provider=KEYNEST) */
    private String providerStoreId;

    /** Type de gardien : MERCHANT ou INDIVIDUAL (uniquement pour CLENZY_KEYVAULT, defaut MERCHANT) */
    private String guardianType;

    @NotBlank(message = "Le nom du commercant est requis")
    @Size(max = 255, message = "Le nom ne peut pas depasser 255 caracteres")
    private String storeName;

    @Size(max = 500, message = "L'adresse ne peut pas depasser 500 caracteres")
    private String storeAddress;

    @Size(max = 50, message = "Le telephone ne peut pas depasser 50 caracteres")
    private String storePhone;

    private Double storeLat;
    private Double storeLng;

    private String storeOpeningHours;

    // ─── Getters / Setters ──────────────────────────────────────

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getProviderStoreId() { return providerStoreId; }
    public void setProviderStoreId(String providerStoreId) { this.providerStoreId = providerStoreId; }

    public String getGuardianType() { return guardianType; }
    public void setGuardianType(String guardianType) { this.guardianType = guardianType; }

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
}
