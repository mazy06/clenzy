package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Profil fiscal d'une organisation.
 * Relation 1:1 avec Organization - definit le pays, la devise,
 * le regime fiscal et les informations legales pour la facturation.
 */
@Entity
@Table(name = "fiscal_profiles", indexes = {
    @Index(name = "idx_fiscal_profile_country", columnList = "country_code"),
    @Index(name = "idx_fiscal_profile_org", columnList = "organization_id")
})
public class FiscalProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false, unique = true)
    private Long organizationId;

    @NotBlank
    @Size(max = 3)
    @Column(name = "country_code", nullable = false, length = 3)
    private String countryCode = "FR";

    @NotBlank
    @Size(max = 3)
    @Column(name = "default_currency", nullable = false, length = 3)
    private String defaultCurrency = "EUR";

    @Size(max = 50)
    @Column(name = "tax_id_number", length = 50)
    private String taxIdNumber;

    @Size(max = 30)
    @Column(name = "vat_number", length = 30)
    private String vatNumber;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "fiscal_regime", nullable = false, length = 30)
    private FiscalRegime fiscalRegime = FiscalRegime.STANDARD;

    @Column(name = "vat_registered", nullable = false)
    private boolean vatRegistered = true;

    @Size(max = 15)
    @Column(name = "vat_declaration_frequency", length = 15)
    private String vatDeclarationFrequency = "MONTHLY";

    @Size(max = 5)
    @Column(name = "invoice_language", length = 5)
    private String invoiceLanguage = "fr";

    @Size(max = 10)
    @Column(name = "invoice_prefix", length = 10)
    private String invoicePrefix = "FA-";

    @Column(name = "legal_mentions", columnDefinition = "TEXT")
    private String legalMentions;

    @Size(max = 200)
    @Column(name = "legal_entity_name", length = 200)
    private String legalEntityName;

    @Column(name = "legal_address", columnDefinition = "TEXT")
    private String legalAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // --- Constructeurs ---

    public FiscalProfile() {}

    public FiscalProfile(Long organizationId, String countryCode, String defaultCurrency) {
        this.organizationId = organizationId;
        this.countryCode = countryCode;
        this.defaultCurrency = defaultCurrency;
    }

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }

    public String getDefaultCurrency() { return defaultCurrency; }
    public void setDefaultCurrency(String defaultCurrency) { this.defaultCurrency = defaultCurrency; }

    public String getTaxIdNumber() { return taxIdNumber; }
    public void setTaxIdNumber(String taxIdNumber) { this.taxIdNumber = taxIdNumber; }

    public String getVatNumber() { return vatNumber; }
    public void setVatNumber(String vatNumber) { this.vatNumber = vatNumber; }

    public FiscalRegime getFiscalRegime() { return fiscalRegime; }
    public void setFiscalRegime(FiscalRegime fiscalRegime) { this.fiscalRegime = fiscalRegime; }

    public boolean isVatRegistered() { return vatRegistered; }
    public void setVatRegistered(boolean vatRegistered) { this.vatRegistered = vatRegistered; }

    public String getVatDeclarationFrequency() { return vatDeclarationFrequency; }
    public void setVatDeclarationFrequency(String vatDeclarationFrequency) { this.vatDeclarationFrequency = vatDeclarationFrequency; }

    public String getInvoiceLanguage() { return invoiceLanguage; }
    public void setInvoiceLanguage(String invoiceLanguage) { this.invoiceLanguage = invoiceLanguage; }

    public String getInvoicePrefix() { return invoicePrefix; }
    public void setInvoicePrefix(String invoicePrefix) { this.invoicePrefix = invoicePrefix; }

    public String getLegalMentions() { return legalMentions; }
    public void setLegalMentions(String legalMentions) { this.legalMentions = legalMentions; }

    public String getLegalEntityName() { return legalEntityName; }
    public void setLegalEntityName(String legalEntityName) { this.legalEntityName = legalEntityName; }

    public String getLegalAddress() { return legalAddress; }
    public void setLegalAddress(String legalAddress) { this.legalAddress = legalAddress; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    @Override
    public String toString() {
        return "FiscalProfile{" +
                "id=" + id +
                ", organizationId=" + organizationId +
                ", countryCode='" + countryCode + '\'' +
                ", defaultCurrency='" + defaultCurrency + '\'' +
                ", fiscalRegime=" + fiscalRegime +
                '}';
    }
}
