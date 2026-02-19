package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "pricing_configs")
@org.hibernate.annotations.FilterDef(
    name = "organizationFilter",
    parameters = @org.hibernate.annotations.ParamDef(name = "orgId", type = Long.class)
)
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class PricingConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    // Coefficient maps stored as JSON TEXT
    @Column(name = "property_type_coeffs", columnDefinition = "TEXT")
    private String propertyTypeCoeffs;

    @Column(name = "property_count_coeffs", columnDefinition = "TEXT")
    private String propertyCountCoeffs;

    @Column(name = "guest_capacity_coeffs", columnDefinition = "TEXT")
    private String guestCapacityCoeffs;

    @Column(name = "frequency_coeffs", columnDefinition = "TEXT")
    private String frequencyCoeffs;

    @Column(name = "surface_tiers", columnDefinition = "TEXT")
    private String surfaceTiers;

    // Package base prices (EUR)
    @Column(name = "base_price_essentiel")
    private Integer basePriceEssentiel;

    @Column(name = "base_price_confort")
    private Integer basePriceConfort;

    @Column(name = "base_price_premium")
    private Integer basePricePremium;

    // Minimum price floor (EUR)
    @Column(name = "min_price")
    private Integer minPrice;

    // PMS subscription prices (cents for Stripe)
    @Column(name = "pms_monthly_price_cents")
    private Integer pmsMonthlyPriceCents;

    @Column(name = "pms_sync_price_cents")
    private Integer pmsSyncPriceCents;

    // Automation surcharges (EUR)
    @Column(name = "automation_basic_surcharge")
    private Integer automationBasicSurcharge;

    @Column(name = "automation_full_surcharge")
    private Integer automationFullSurcharge;

    // Forfait configs (JSON: Standard, Express, En profondeur)
    @Column(name = "forfait_configs", columnDefinition = "TEXT")
    private String forfaitConfigs;

    // Service category configs (JSON)
    @Column(name = "travaux_config", columnDefinition = "TEXT")
    private String travauxConfig;

    @Column(name = "exterieur_config", columnDefinition = "TEXT")
    private String exterieurConfig;

    @Column(name = "blanchisserie_config", columnDefinition = "TEXT")
    private String blanchisserieConfig;

    @Column(name = "commission_configs", columnDefinition = "TEXT")
    private String commissionConfigs;

    // Forfait catalogs (available prestations and surcharges, JSON)
    @Column(name = "available_prestations", columnDefinition = "TEXT")
    private String availablePrestations;

    @Column(name = "available_surcharges", columnDefinition = "TEXT")
    private String availableSurcharges;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public PricingConfig() {}

    // ─── Getters & Setters ─────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getPropertyTypeCoeffs() { return propertyTypeCoeffs; }
    public void setPropertyTypeCoeffs(String propertyTypeCoeffs) { this.propertyTypeCoeffs = propertyTypeCoeffs; }

    public String getPropertyCountCoeffs() { return propertyCountCoeffs; }
    public void setPropertyCountCoeffs(String propertyCountCoeffs) { this.propertyCountCoeffs = propertyCountCoeffs; }

    public String getGuestCapacityCoeffs() { return guestCapacityCoeffs; }
    public void setGuestCapacityCoeffs(String guestCapacityCoeffs) { this.guestCapacityCoeffs = guestCapacityCoeffs; }

    public String getFrequencyCoeffs() { return frequencyCoeffs; }
    public void setFrequencyCoeffs(String frequencyCoeffs) { this.frequencyCoeffs = frequencyCoeffs; }

    public String getSurfaceTiers() { return surfaceTiers; }
    public void setSurfaceTiers(String surfaceTiers) { this.surfaceTiers = surfaceTiers; }

    public Integer getBasePriceEssentiel() { return basePriceEssentiel; }
    public void setBasePriceEssentiel(Integer basePriceEssentiel) { this.basePriceEssentiel = basePriceEssentiel; }

    public Integer getBasePriceConfort() { return basePriceConfort; }
    public void setBasePriceConfort(Integer basePriceConfort) { this.basePriceConfort = basePriceConfort; }

    public Integer getBasePricePremium() { return basePricePremium; }
    public void setBasePricePremium(Integer basePricePremium) { this.basePricePremium = basePricePremium; }

    public Integer getMinPrice() { return minPrice; }
    public void setMinPrice(Integer minPrice) { this.minPrice = minPrice; }

    public Integer getPmsMonthlyPriceCents() { return pmsMonthlyPriceCents; }
    public void setPmsMonthlyPriceCents(Integer pmsMonthlyPriceCents) { this.pmsMonthlyPriceCents = pmsMonthlyPriceCents; }

    public Integer getPmsSyncPriceCents() { return pmsSyncPriceCents; }
    public void setPmsSyncPriceCents(Integer pmsSyncPriceCents) { this.pmsSyncPriceCents = pmsSyncPriceCents; }

    public Integer getAutomationBasicSurcharge() { return automationBasicSurcharge; }
    public void setAutomationBasicSurcharge(Integer automationBasicSurcharge) { this.automationBasicSurcharge = automationBasicSurcharge; }

    public Integer getAutomationFullSurcharge() { return automationFullSurcharge; }
    public void setAutomationFullSurcharge(Integer automationFullSurcharge) { this.automationFullSurcharge = automationFullSurcharge; }

    public String getForfaitConfigs() { return forfaitConfigs; }
    public void setForfaitConfigs(String forfaitConfigs) { this.forfaitConfigs = forfaitConfigs; }

    public String getTravauxConfig() { return travauxConfig; }
    public void setTravauxConfig(String travauxConfig) { this.travauxConfig = travauxConfig; }

    public String getExterieurConfig() { return exterieurConfig; }
    public void setExterieurConfig(String exterieurConfig) { this.exterieurConfig = exterieurConfig; }

    public String getBlanchisserieConfig() { return blanchisserieConfig; }
    public void setBlanchisserieConfig(String blanchisserieConfig) { this.blanchisserieConfig = blanchisserieConfig; }

    public String getCommissionConfigs() { return commissionConfigs; }
    public void setCommissionConfigs(String commissionConfigs) { this.commissionConfigs = commissionConfigs; }

    public String getAvailablePrestations() { return availablePrestations; }
    public void setAvailablePrestations(String availablePrestations) { this.availablePrestations = availablePrestations; }

    public String getAvailableSurcharges() { return availableSurcharges; }
    public void setAvailableSurcharges(String availableSurcharges) { this.availableSurcharges = availableSurcharges; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
