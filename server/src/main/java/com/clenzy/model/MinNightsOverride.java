package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Surcharge du minimum de nuits pour une propriete et une date specifique.
 *
 * Les overrides ont la priorite sur le `minimumNights` de la propriete :
 * la resolution est faite a la date d'arrivee (check-in). Si une date a
 * un override, le minimum effectif est celui de l'override ; sinon, le
 * defaut de la propriete s'applique.
 *
 * Cas d'usage :
 * - Minimum 4 nuits sur les week-ends prolonges
 * - Minimum 7 nuits en haute saison (juillet/aout)
 * - Restriction temporaire pour evenement local
 */
@Entity
@Table(name = "min_nights_overrides",
       uniqueConstraints = @UniqueConstraint(columnNames = {"property_id", "date"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class MinNightsOverride {

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

    @Column(name = "min_nights", nullable = false)
    private Integer minNights;

    @Column(length = 50, nullable = false)
    private String source = "MANUAL";

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    public MinNightsOverride() {}

    public MinNightsOverride(Property property, LocalDate date, Integer minNights,
                             String source, Long organizationId) {
        this.property = property;
        this.date = date;
        this.minNights = minNights;
        this.source = source;
        this.organizationId = organizationId;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public Integer getMinNights() { return minNights; }
    public void setMinNights(Integer minNights) { this.minNights = minNights; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    @Override
    public String toString() {
        return "MinNightsOverride{id=" + id + ", date=" + date
                + ", minNights=" + minNights + ", source='" + source + "'}";
    }
}
