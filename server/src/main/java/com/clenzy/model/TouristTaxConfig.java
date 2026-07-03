package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Barème de taxe de séjour saisi par l'organisation (v1 Baitly : pas d'API
 * DGFiP, la conciergerie saisit ses barèmes communaux).
 *
 * <p>{@code propertyId} null = barème PAR DÉFAUT de l'org ; sinon override par
 * bien. Résolution : override par bien &gt; défaut org &gt; absent.</p>
 */
@Entity
@Table(name = "tourist_tax_configs")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class TouristTaxConfig {

    public enum TaxCalculationMode {
        /** Hébergement classé : montant fixe €/personne/nuit. */
        PER_PERSON_PER_NIGHT,
        /** Non classé « au réel » : % du prix de la nuitée par personne, plafonné par {@link #capPerPersonNight}. */
        PERCENTAGE_OF_RATE,
        /** Forfait €/nuit (indépendant du nombre de personnes). */
        FLAT_PER_NIGHT
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Null = barème par défaut de l'org, sinon override par bien. */
    @Column(name = "property_id")
    private Long propertyId;

    @Column(name = "commune_name", nullable = false)
    private String communeName;

    @Column(name = "commune_code", length = 10)
    private String communeCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "calculation_mode", nullable = false, length = 30)
    private TaxCalculationMode calculationMode = TaxCalculationMode.PER_PERSON_PER_NIGHT;

    @Column(name = "rate_per_person", precision = 6, scale = 2)
    private BigDecimal ratePerPerson;

    /** Fraction (0.05 = 5 %) du prix de la nuitée — mode PERCENTAGE_OF_RATE. */
    @Column(name = "percentage_rate", precision = 5, scale = 4)
    private BigDecimal percentageRate;

    /** Plafond €/personne/nuit du mode PERCENTAGE_OF_RATE (« au réel » plafonné). Null = pas de plafond. */
    @Column(name = "cap_per_person_night", precision = 6, scale = 2)
    private BigDecimal capPerPersonNight;

    /** Taxe additionnelle départementale en % (typiquement 10). Null = 0. */
    @Column(name = "departmental_surcharge_pct", precision = 6, scale = 2)
    private BigDecimal departmentalSurchargePct;

    /** Taxe additionnelle régionale en % (ex. Île-de-France). Null = 0. */
    @Column(name = "regional_surcharge_pct", precision = 6, scale = 2)
    private BigDecimal regionalSurchargePct;

    /**
     * Exonération légale des mineurs (&lt;18 ans). v1 : sans effet de calcul tant
     * que Reservation ne porte que {@code guestCount} (pas de ventilation
     * adultes/enfants) — champ posé pour la suite.
     */
    @Column(name = "exempt_minors", nullable = false)
    private Boolean exemptMinors = true;

    @Column(name = "max_nights")
    private Integer maxNights;

    @Column(name = "children_exempt_under")
    private Integer childrenExemptUnder = 18;

    @Column(nullable = false)
    private Boolean enabled = true;

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
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public String getCommuneName() { return communeName; }
    public void setCommuneName(String communeName) { this.communeName = communeName; }
    public String getCommuneCode() { return communeCode; }
    public void setCommuneCode(String communeCode) { this.communeCode = communeCode; }
    public TaxCalculationMode getCalculationMode() { return calculationMode; }
    public void setCalculationMode(TaxCalculationMode calculationMode) { this.calculationMode = calculationMode; }
    public BigDecimal getRatePerPerson() { return ratePerPerson; }
    public void setRatePerPerson(BigDecimal ratePerPerson) { this.ratePerPerson = ratePerPerson; }
    public BigDecimal getPercentageRate() { return percentageRate; }
    public void setPercentageRate(BigDecimal percentageRate) { this.percentageRate = percentageRate; }
    public BigDecimal getCapPerPersonNight() { return capPerPersonNight; }
    public void setCapPerPersonNight(BigDecimal capPerPersonNight) { this.capPerPersonNight = capPerPersonNight; }
    public BigDecimal getDepartmentalSurchargePct() { return departmentalSurchargePct; }
    public void setDepartmentalSurchargePct(BigDecimal departmentalSurchargePct) { this.departmentalSurchargePct = departmentalSurchargePct; }
    public BigDecimal getRegionalSurchargePct() { return regionalSurchargePct; }
    public void setRegionalSurchargePct(BigDecimal regionalSurchargePct) { this.regionalSurchargePct = regionalSurchargePct; }
    public Boolean getExemptMinors() { return exemptMinors; }
    public void setExemptMinors(Boolean exemptMinors) { this.exemptMinors = exemptMinors; }
    public Integer getMaxNights() { return maxNights; }
    public void setMaxNights(Integer maxNights) { this.maxNights = maxNights; }
    public Integer getChildrenExemptUnder() { return childrenExemptUnder; }
    public void setChildrenExemptUnder(Integer childrenExemptUnder) { this.childrenExemptUnder = childrenExemptUnder; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
