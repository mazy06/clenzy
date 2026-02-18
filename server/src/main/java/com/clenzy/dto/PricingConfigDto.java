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

    // Forfait configs (Standard, Express, En profondeur)
    private List<ForfaitConfig> forfaitConfigs;

    // ─── Inner class for forfait configuration ──────────────────────

    public static class ForfaitConfig {
        private String key;                        // "CLEANING", "EXPRESS_CLEANING", "DEEP_CLEANING"
        private String label;                      // "Standard", "Express", "En profondeur"
        private Double coeffMin;
        private Double coeffMax;
        private List<String> serviceTypes;         // intervention types associated
        private List<String> includedPrestations;  // prestations included in base price
        private List<String> extraPrestations;     // prestations billed as extras
        private List<Long> eligibleTeamIds;        // eligible teams (empty = all)
        private Map<String, Double> surcharges;    // perBedroom, perBathroom, etc.
        private List<SurfaceBasePrice> surfaceBasePrices;

        public ForfaitConfig() {}

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public Double getCoeffMin() { return coeffMin; }
        public void setCoeffMin(Double coeffMin) { this.coeffMin = coeffMin; }

        public Double getCoeffMax() { return coeffMax; }
        public void setCoeffMax(Double coeffMax) { this.coeffMax = coeffMax; }

        public List<String> getServiceTypes() { return serviceTypes; }
        public void setServiceTypes(List<String> serviceTypes) { this.serviceTypes = serviceTypes; }

        public List<String> getIncludedPrestations() { return includedPrestations; }
        public void setIncludedPrestations(List<String> includedPrestations) { this.includedPrestations = includedPrestations; }

        public List<String> getExtraPrestations() { return extraPrestations; }
        public void setExtraPrestations(List<String> extraPrestations) { this.extraPrestations = extraPrestations; }

        public List<Long> getEligibleTeamIds() { return eligibleTeamIds; }
        public void setEligibleTeamIds(List<Long> eligibleTeamIds) { this.eligibleTeamIds = eligibleTeamIds; }

        public Map<String, Double> getSurcharges() { return surcharges; }
        public void setSurcharges(Map<String, Double> surcharges) { this.surcharges = surcharges; }

        public List<SurfaceBasePrice> getSurfaceBasePrices() { return surfaceBasePrices; }
        public void setSurfaceBasePrices(List<SurfaceBasePrice> surfaceBasePrices) { this.surfaceBasePrices = surfaceBasePrices; }
    }

    // ─── Inner class for surface base prices in forfaits ────────────

    public static class SurfaceBasePrice {
        private Integer maxSurface;
        private Integer base;

        public SurfaceBasePrice() {}

        public SurfaceBasePrice(Integer maxSurface, Integer base) {
            this.maxSurface = maxSurface;
            this.base = base;
        }

        public Integer getMaxSurface() { return maxSurface; }
        public void setMaxSurface(Integer maxSurface) { this.maxSurface = maxSurface; }

        public Integer getBase() { return base; }
        public void setBase(Integer base) { this.base = base; }
    }

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

    public List<ForfaitConfig> getForfaitConfigs() { return forfaitConfigs; }
    public void setForfaitConfigs(List<ForfaitConfig> forfaitConfigs) { this.forfaitConfigs = forfaitConfigs; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
