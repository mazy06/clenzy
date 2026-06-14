package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Pays supporte par la plateforme (config globale, non org-scopee).
 *
 * Socle du cap multi-pays (FR + Maroc + Arabie Saoudite) : centralise les capacites
 * et conventions par pays (devise, locale, fuseau, week-end, fiscalite, e-invoicing,
 * declaration voyageurs) afin que les registries (TaxCalculator, EInvoicingProvider,
 * GuestRegistrationProvider...) et les regles metier resolvent leur comportement
 * via {@code country_code} (ISO 3166-1 alpha-2 : FR, MA, SA).
 *
 * {@code enabled} pilote le rollout progressif : la France est active par defaut,
 * les autres pays s'activent un par un (cf. fiscal.multi-country.enabled + CountryService).
 */
@Entity
@Table(name = "countries", indexes = {
    @Index(name = "idx_country_code", columnList = "country_code", unique = true)
})
public class Country {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Code ISO 3166-1 alpha-2 (cle de resolution des registries : FR, MA, SA). */
    @NotBlank
    @Size(max = 2)
    @Column(name = "country_code", nullable = false, length = 2, unique = true)
    private String countryCode;

    @NotBlank
    @Size(max = 100)
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @NotBlank
    @Size(max = 3)
    @Column(name = "default_currency", nullable = false, length = 3)
    private String defaultCurrency;

    @NotBlank
    @Size(max = 5)
    @Column(name = "default_locale", nullable = false, length = 5)
    private String defaultLocale = "fr-FR";

    @NotBlank
    @Size(max = 64)
    @Column(name = "timezone", nullable = false, length = 64)
    private String timezone = "Europe/Paris";

    /** Jours de week-end (noms DayOfWeek separes par virgule). KSA = FRIDAY,SATURDAY. */
    @NotBlank
    @Size(max = 32)
    @Column(name = "weekend_days", nullable = false, length = 32)
    private String weekendDays = "SATURDAY,SUNDAY";

    /** Sens de lecture droite-a-gauche (arabe). */
    @Column(name = "rtl", nullable = false)
    private boolean rtl = false;

    @Column(name = "vat_registered", nullable = false)
    private boolean vatRegistered = true;

    /** Code du provider d'e-invoicing (ex. factur_x, dgi_ma, zatca) ; null si aucun. */
    @Size(max = 40)
    @Column(name = "einvoicing_provider", length = 40)
    private String einvoicingProvider;

    /** Code du provider de declaration voyageurs (ex. police_fr, dgsn_ma, shomoos_ksa) ; null si aucun. */
    @Size(max = 40)
    @Column(name = "guest_registration_provider", length = 40)
    private String guestRegistrationProvider;

    /** Pays actif pour l'exploitation (rollout progressif). */
    @Column(name = "enabled", nullable = false)
    private boolean enabled = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // --- Constructeurs ---

    public Country() {}

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDefaultCurrency() { return defaultCurrency; }
    public void setDefaultCurrency(String defaultCurrency) { this.defaultCurrency = defaultCurrency; }

    public String getDefaultLocale() { return defaultLocale; }
    public void setDefaultLocale(String defaultLocale) { this.defaultLocale = defaultLocale; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public String getWeekendDays() { return weekendDays; }
    public void setWeekendDays(String weekendDays) { this.weekendDays = weekendDays; }

    public boolean isRtl() { return rtl; }
    public void setRtl(boolean rtl) { this.rtl = rtl; }

    public boolean isVatRegistered() { return vatRegistered; }
    public void setVatRegistered(boolean vatRegistered) { this.vatRegistered = vatRegistered; }

    public String getEinvoicingProvider() { return einvoicingProvider; }
    public void setEinvoicingProvider(String einvoicingProvider) { this.einvoicingProvider = einvoicingProvider; }

    public String getGuestRegistrationProvider() { return guestRegistrationProvider; }
    public void setGuestRegistrationProvider(String guestRegistrationProvider) { this.guestRegistrationProvider = guestRegistrationProvider; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    @Override
    public String toString() {
        return "Country{" + countryCode + " " + name + " " + defaultCurrency + " enabled=" + enabled + '}';
    }
}
