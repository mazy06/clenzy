package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "tourist_tax_configs")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class TouristTaxConfig {

    public enum TaxCalculationMode {
        PER_PERSON_PER_NIGHT,
        PERCENTAGE_OF_RATE,
        FLAT_PER_NIGHT
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
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

    @Column(name = "percentage_rate", precision = 5, scale = 4)
    private BigDecimal percentageRate;

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
    public Integer getMaxNights() { return maxNights; }
    public void setMaxNights(Integer maxNights) { this.maxNights = maxNights; }
    public Integer getChildrenExemptUnder() { return childrenExemptUnder; }
    public void setChildrenExemptUnder(Integer childrenExemptUnder) { this.childrenExemptUnder = childrenExemptUnder; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
