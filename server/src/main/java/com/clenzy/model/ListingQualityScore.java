package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Score qualité d'annonce d'un logement (0..100, vague M-A) — v1 heuristique :
 * photos, description, équipements, note moyenne. Le {@link #breakdown} garde le
 * détail par contributeur (les contributeurs v2, vision LLM, s'y ajouteront).
 */
@Entity
@Table(name = "listing_quality_scores")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ListingQualityScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(nullable = false)
    private int score;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String breakdown = "{}";

    @Column(name = "computed_at", nullable = false)
    private LocalDateTime computedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }
    public String getBreakdown() { return breakdown; }
    public void setBreakdown(String breakdown) { this.breakdown = breakdown; }
    public LocalDateTime getComputedAt() { return computedAt; }
    public void setComputedAt(LocalDateTime computedAt) { this.computedAt = computedAt; }
}
