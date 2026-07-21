package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Photo quotidienne d'une nuit du calendrier publié (fondations RMS R1) :
 * prix résolu par la cascade PriceEngine, statut effectif et min_stay, vus le
 * {@code snapshotDate}. Table APPEND-ONLY écrite en batch JDBC par
 * {@code CalendarSnapshotService} (ON CONFLICT DO NOTHING) — l'entité sert la
 * parité de schéma (ddl-auto des tests, validate en prod) et les lectures futures
 * (booking curve prix, forecast R3), jamais l'écriture unitaire.
 */
@Entity
@Table(name = "calendar_day_snapshots")
@IdClass(CalendarDaySnapshotId.class)
public class CalendarDaySnapshot {

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Id
    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    /** La nuit concernée (date métier). */
    @Id
    @Column(name = "stay_date", nullable = false)
    private LocalDate stayDate;

    /** Le jour de la photo. */
    @Id
    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    /** Prix publié résolu par la cascade — null si aucun tarif applicable. */
    @Column(name = "published_price", precision = 10, scale = 2)
    private BigDecimal publishedPrice;

    @Column(name = "currency", length = 3)
    private String currency;

    /** Source de la cascade : OVERRIDE, un RatePlanType, ou PROPERTY_DEFAULT. */
    @Column(name = "price_source", nullable = false, length = 32)
    private String priceSource;

    /** Statut effectif : AVAILABLE (y compris absence de ligne calendar_days), BOOKED, BLOCKED... */
    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "min_stay")
    private Integer minStay;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    public Long getOrganizationId() { return organizationId; }
    public Long getPropertyId() { return propertyId; }
    public LocalDate getStayDate() { return stayDate; }
    public LocalDate getSnapshotDate() { return snapshotDate; }
    public BigDecimal getPublishedPrice() { return publishedPrice; }
    public String getCurrency() { return currency; }
    public String getPriceSource() { return priceSource; }
    public String getStatus() { return status; }
    public Integer getMinStay() { return minStay; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
