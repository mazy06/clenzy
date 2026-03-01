package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Prix specifique par date pour une propriete.
 *
 * Les overrides ont la priorite maximale dans la resolution de prix :
 * ils ecrasent tous les rate plans pour la date concernee.
 *
 * Cas d'usage :
 * - Prix ajuste manuellement pour un evenement local
 * - Sync depuis un channel (Airbnb dynamic pricing)
 * - Promotion flash sur une date specifique
 */
@Entity
@Table(name = "rate_overrides",
       uniqueConstraints = @UniqueConstraint(columnNames = {"property_id", "date"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class RateOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "nightly_price", precision = 10, scale = 2, nullable = false)
    private BigDecimal nightlyPrice;

    @Column(length = 50, nullable = false)
    private String source = "MANUAL";

    @Column(length = 3, nullable = false)
    private String currency = "EUR";

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    // Constructeurs

    public RateOverride() {}

    public RateOverride(Property property, LocalDate date, BigDecimal nightlyPrice,
                        String source, Long organizationId) {
        this.property = property;
        this.date = date;
        this.nightlyPrice = nightlyPrice;
        this.source = source;
        this.organizationId = organizationId;
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public BigDecimal getNightlyPrice() { return nightlyPrice; }
    public void setNightlyPrice(BigDecimal nightlyPrice) { this.nightlyPrice = nightlyPrice; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    @Override
    public String toString() {
        return "RateOverride{id=" + id + ", date=" + date + ", nightlyPrice=" + nightlyPrice
                + ", source='" + source + "'}";
    }
}
