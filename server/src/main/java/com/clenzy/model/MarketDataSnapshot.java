package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Benchmark de marché persisté (roadmap market data) — append-only, historisé
 * par {@code snapshot_date}. Écrit par l'ingestion quotidienne depuis les
 * {@code MarketDataProvider}, lu par les consommateurs RMS (benchmark, base
 * price, dashboards).
 *
 * <p>Vie privée : pour la source FIRST_PARTY, seules des cellules agrégées
 * k-anonymes (sample_size ≥ 5, garanti EN SQL à la source) sont persistées —
 * jamais d'identifiant de bien ou d'org d'un autre tenant.
 * {@code organization_id} est null pour les benchmarks plateforme/globaux.</p>
 */
@Entity
@Table(name = "market_data_snapshots")
public class MarketDataSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Null = benchmark plateforme (first-party agrégé, open data). */
    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "area", nullable = false, length = 120)
    private String area;

    @Column(name = "country_code", length = 2)
    private String countryCode;

    @Column(name = "source", nullable = false, length = 24)
    private String source;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    /** Mois de séjour "2026-08" — granularité commune à toutes les sources. */
    @Column(name = "stay_month", nullable = false, length = 7)
    private String stayMonth;

    @Column(name = "adr", precision = 12, scale = 2)
    private BigDecimal adr;

    @Column(name = "occupancy_pct", precision = 5, scale = 2)
    private BigDecimal occupancyPct;

    @Column(name = "revpar", precision = 12, scale = 2)
    private BigDecimal revPar;

    @Column(name = "currency", length = 3)
    private String currency;

    /** Nombre de biens distincts dans l'agrégat (k-anonymat : toujours ≥ 5 en FIRST_PARTY). */
    @Column(name = "sample_size", nullable = false)
    private int sampleSize;

    /** Indice 0-1 : densité de l'échantillon × fiabilité de la source. */
    @Column(name = "confidence", nullable = false, precision = 3, scale = 2)
    private BigDecimal confidence;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    public MarketDataSnapshot() {
    }

    public MarketDataSnapshot(Long organizationId, String area, String countryCode, String source,
                              LocalDate snapshotDate, String stayMonth, BigDecimal adr,
                              BigDecimal occupancyPct, BigDecimal revPar, String currency,
                              int sampleSize, BigDecimal confidence) {
        this.organizationId = organizationId;
        this.area = area;
        this.countryCode = countryCode;
        this.source = source;
        this.snapshotDate = snapshotDate;
        this.stayMonth = stayMonth;
        this.adr = adr;
        this.occupancyPct = occupancyPct;
        this.revPar = revPar;
        this.currency = currency;
        this.sampleSize = sampleSize;
        this.confidence = confidence;
    }

    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public String getArea() { return area; }
    public String getCountryCode() { return countryCode; }
    public String getSource() { return source; }
    public LocalDate getSnapshotDate() { return snapshotDate; }
    public String getStayMonth() { return stayMonth; }
    public BigDecimal getAdr() { return adr; }
    public BigDecimal getOccupancyPct() { return occupancyPct; }
    public BigDecimal getRevPar() { return revPar; }
    public String getCurrency() { return currency; }
    public int getSampleSize() { return sampleSize; }
    public BigDecimal getConfidence() { return confidence; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
