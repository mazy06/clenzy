package com.clenzy.dto;

import java.util.List;
import java.util.Map;

public class PricingConfigDto {

    private Long id;

    // Coefficient maps (deserialized from JSON)
    private Map<String, Double> propertyTypeCoeffs;
    private Map<String, Double> propertyCountCoeffs;
    private Map<String, Double> guestCapacityCoeffs;
    private Map<String, Double> frequencyCoeffs;
    private List<SurfaceTier> surfaceTiers;

    // Base prices (EUR)
    private Integer basePriceEssentiel;
    private Integer basePriceConfort;
    private Integer basePricePremium;
    private Integer minPrice;

    // PMS subscription (cents)
    private Integer pmsMonthlyPriceCents;
    private Integer pmsSyncPriceCents;

    // Automation surcharges (EUR)
    private Integer automationBasicSurcharge;
    private Integer automationFullSurcharge;

    private String updatedAt;

    // ─── Inner class for surface tiers ──────────────────────────────

    public static class SurfaceTier {
        private Integer maxSurface;
        private Double coeff;
        private String label;

        public SurfaceTier() {}

        public SurfaceTier(Integer maxSurface, Double coeff, String label) {
            this.maxSurface = maxSurface;
            this.coeff = coeff;
            this.label = label;
        }

        public Integer getMaxSurface() { return maxSurface; }
        public void setMaxSurface(Integer maxSurface) { this.maxSurface = maxSurface; }

        public Double getCoeff() { return coeff; }
        public void setCoeff(Double coeff) { this.coeff = coeff; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
    }

    // ─── Getters & Setters ─────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Map<String, Double> getPropertyTypeCoeffs() { return propertyTypeCoeffs; }
    public void setPropertyTypeCoeffs(Map<String, Double> propertyTypeCoeffs) { this.propertyTypeCoeffs = propertyTypeCoeffs; }

    public Map<String, Double> getPropertyCountCoeffs() { return propertyCountCoeffs; }
    public void setPropertyCountCoeffs(Map<String, Double> propertyCountCoeffs) { this.propertyCountCoeffs = propertyCountCoeffs; }

    public Map<String, Double> getGuestCapacityCoeffs() { return guestCapacityCoeffs; }
    public void setGuestCapacityCoeffs(Map<String, Double> guestCapacityCoeffs) { this.guestCapacityCoeffs = guestCapacityCoeffs; }

    public Map<String, Double> getFrequencyCoeffs() { return frequencyCoeffs; }
    public void setFrequencyCoeffs(Map<String, Double> frequencyCoeffs) { this.frequencyCoeffs = frequencyCoeffs; }

    public List<SurfaceTier> getSurfaceTiers() { return surfaceTiers; }
    public void setSurfaceTiers(List<SurfaceTier> surfaceTiers) { this.surfaceTiers = surfaceTiers; }

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

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
