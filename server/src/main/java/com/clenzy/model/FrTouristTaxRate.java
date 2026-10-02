package com.clenzy.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Tarif de taxe de sejour delibere par une commune (France), copie du referentiel DGFiP
 * DELTA. Donnee PLATEFORME publique : pas d'organisation, pas de filtre tenant.
 */
@Entity
@Table(name = "fr_tourist_tax_rates")
public class FrTouristTaxRate {

    /** Categorie d'hebergement normalisee (seules celles utiles a la location courte duree). */
    public enum Category {
        MEUBLE_1, MEUBLE_2, MEUBLE_3, MEUBLE_4, MEUBLE_5, UNCLASSIFIED, CHAMBRE_HOTES, PALACE, OTHER
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "insee_code", nullable = false, length = 5)
    private String inseeCode;

    @Column(name = "commune_name", length = 200)
    private String communeName;

    @Column(name = "effective_year", nullable = false)
    private int effectiveYear;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(name = "accommodation_label", nullable = false, length = 300)
    private String accommodationLabel;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 40)
    private Category category;

    @Column(name = "regime", length = 20)
    private String regime;

    @Column(name = "rate", precision = 10, scale = 4)
    private BigDecimal rate;

    /** {@code EUR} (montant par personne et par nuit) ou {@code PCT} (pourcentage du prix). */
    @Column(name = "rate_unit", length = 4)
    private String rateUnit;

    @Column(name = "departmental_pct", precision = 7, scale = 2)
    private BigDecimal departmentalPct;

    @Column(name = "other_additional_pct", precision = 7, scale = 2)
    private BigDecimal otherAdditionalPct;

    @Column(name = "collector_siren", length = 9)
    private String collectorSiren;

    @Column(name = "fetched_at", nullable = false)
    private LocalDateTime fetchedAt;

    public Long getId() { return id; }
    public String getInseeCode() { return inseeCode; }
    public void setInseeCode(String inseeCode) { this.inseeCode = inseeCode; }
    public String getCommuneName() { return communeName; }
    public void setCommuneName(String communeName) { this.communeName = communeName; }
    public int getEffectiveYear() { return effectiveYear; }
    public void setEffectiveYear(int effectiveYear) { this.effectiveYear = effectiveYear; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(LocalDate effectiveTo) { this.effectiveTo = effectiveTo; }
    public String getAccommodationLabel() { return accommodationLabel; }
    public void setAccommodationLabel(String accommodationLabel) { this.accommodationLabel = accommodationLabel; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public String getRegime() { return regime; }
    public void setRegime(String regime) { this.regime = regime; }
    public BigDecimal getRate() { return rate; }
    public void setRate(BigDecimal rate) { this.rate = rate; }
    public String getRateUnit() { return rateUnit; }
    public void setRateUnit(String rateUnit) { this.rateUnit = rateUnit; }
    public BigDecimal getDepartmentalPct() { return departmentalPct; }
    public void setDepartmentalPct(BigDecimal departmentalPct) { this.departmentalPct = departmentalPct; }
    public BigDecimal getOtherAdditionalPct() { return otherAdditionalPct; }
    public void setOtherAdditionalPct(BigDecimal otherAdditionalPct) { this.otherAdditionalPct = otherAdditionalPct; }
    public String getCollectorSiren() { return collectorSiren; }
    public void setCollectorSiren(String collectorSiren) { this.collectorSiren = collectorSiren; }
    public LocalDateTime getFetchedAt() { return fetchedAt; }
    public void setFetchedAt(LocalDateTime fetchedAt) { this.fetchedAt = fetchedAt; }
}
