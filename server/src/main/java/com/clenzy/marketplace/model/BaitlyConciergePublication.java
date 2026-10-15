package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;

/** Opt-in révocable et snapshot agrégé, sans référence à un logement ou voyageur. */
@Entity
@Table(name = "baitly_concierge_publications")
public class BaitlyConciergePublication {
    @Id @Column(name="provider_id") public Long providerId;
    @Column(nullable=false) public boolean published;
    @Column(name="period_start", nullable=false) public LocalDate periodStart;
    @Column(name="period_end", nullable=false) public LocalDate periodEnd;
    @Column(name="managed_properties", nullable=false) public int managedProperties;
    @Column(name="occupancy_pct", precision=5, scale=1) public BigDecimal occupancyPct;
    @Column(name="updated_at", nullable=false) public Instant updatedAt;
    @Column(name="consented_by", nullable=false, length=100) public String consentedBy;
}
