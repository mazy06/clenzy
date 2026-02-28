package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Regle fiscale configurable par pays et categorie de taxation.
 * Chaque regle a une plage d'effectivite (effective_from/effective_to).
 * Permet de gerer les changements de taux dans le temps.
 */
@Entity
@Table(name = "tax_rules", indexes = {
    @Index(name = "idx_tax_rule_lookup", columnList = "country_code, tax_category")
})
public class TaxRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 3)
    @Column(name = "country_code", nullable = false, length = 3)
    private String countryCode;

    @NotBlank
    @Size(max = 30)
    @Column(name = "tax_category", nullable = false, length = 30)
    private String taxCategory;

    @NotNull
    @Column(name = "tax_rate", nullable = false, precision = 5, scale = 4)
    private BigDecimal taxRate;

    @NotBlank
    @Size(max = 50)
    @Column(name = "tax_name", nullable = false, length = 50)
    private String taxName;

    @NotNull
    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    // --- Constructeurs ---

    public TaxRule() {}

    public TaxRule(String countryCode, String taxCategory, BigDecimal taxRate, String taxName, LocalDate effectiveFrom) {
        this.countryCode = countryCode;
        this.taxCategory = taxCategory;
        this.taxRate = taxRate;
        this.taxName = taxName;
        this.effectiveFrom = effectiveFrom;
    }

    // --- Methodes utilitaires ---

    /**
     * Verifie si cette regle est applicable a une date donnee.
     */
    public boolean isApplicableAt(LocalDate date) {
        if (date.isBefore(effectiveFrom)) return false;
        return effectiveTo == null || !date.isAfter(effectiveTo);
    }

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }

    public String getTaxCategory() { return taxCategory; }
    public void setTaxCategory(String taxCategory) { this.taxCategory = taxCategory; }

    public BigDecimal getTaxRate() { return taxRate; }
    public void setTaxRate(BigDecimal taxRate) { this.taxRate = taxRate; }

    public String getTaxName() { return taxName; }
    public void setTaxName(String taxName) { this.taxName = taxName; }

    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(LocalDate effectiveFrom) { this.effectiveFrom = effectiveFrom; }

    public LocalDate getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(LocalDate effectiveTo) { this.effectiveTo = effectiveTo; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    @Override
    public String toString() {
        return "TaxRule{" +
                "id=" + id +
                ", countryCode='" + countryCode + '\'' +
                ", taxCategory='" + taxCategory + '\'' +
                ", taxRate=" + taxRate +
                ", taxName='" + taxName + '\'' +
                '}';
    }
}
