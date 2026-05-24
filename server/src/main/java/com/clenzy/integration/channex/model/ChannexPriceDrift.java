package com.clenzy.integration.channex.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Detection d'un ecart de prix Clenzy ↔ OTA — Phase 3 OTA pricing.
 *
 * <p>Persistee par {@code ChannexRatesReconciliationScheduler} quand le prix
 * resolu par PriceEngine differe du prix Channex retourne par
 * {@code GET /restrictions} pour une date donnee.</p>
 *
 * <p>Resolution manuelle par l'admin via {@link Resolution} :</p>
 * <ul>
 *   <li>{@link Resolution#KEEP_CLENZY} : on push de force le prix Clenzy vers Channex</li>
 *   <li>{@link Resolution#KEEP_OTA}    : on cree/update un RateOverride avec le prix OTA</li>
 *   <li>{@link Resolution#DISMISSED}   : l'admin ignore l'ecart (cas de difference attendue)</li>
 * </ul>
 *
 * <p>Unicite (property, drift_date) : un seul drift non-resolu actif par date.
 * Si un nouveau scan detecte le meme drift, on update le drift existant (les
 * prix peuvent avoir bouge entre 2 scans).</p>
 */
@Entity
@Table(name = "channex_price_drifts")
public class ChannexPriceDrift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "clenzy_property_id", nullable = false)
    private Long clenzyPropertyId;

    @Column(name = "mapping_id", nullable = false)
    private UUID mappingId;

    @Column(name = "drift_date", nullable = false)
    private LocalDate driftDate;

    @Column(name = "clenzy_price", precision = 10, scale = 2, nullable = false)
    private BigDecimal clenzyPrice;

    @Column(name = "ota_price", precision = 10, scale = 2, nullable = false)
    private BigDecimal otaPrice;

    @Column(length = 3, nullable = false)
    private String currency = "EUR";

    @Column(name = "detected_at", nullable = false)
    private Instant detectedAt = Instant.now();

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Resolution resolution;

    @Column(name = "resolved_by")
    private String resolvedBy;

    public enum Resolution { KEEP_CLENZY, KEEP_OTA, DISMISSED }

    // ─── Getters / setters ──────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getClenzyPropertyId() { return clenzyPropertyId; }
    public void setClenzyPropertyId(Long clenzyPropertyId) { this.clenzyPropertyId = clenzyPropertyId; }

    public UUID getMappingId() { return mappingId; }
    public void setMappingId(UUID mappingId) { this.mappingId = mappingId; }

    public LocalDate getDriftDate() { return driftDate; }
    public void setDriftDate(LocalDate driftDate) { this.driftDate = driftDate; }

    public BigDecimal getClenzyPrice() { return clenzyPrice; }
    public void setClenzyPrice(BigDecimal clenzyPrice) { this.clenzyPrice = clenzyPrice; }

    public BigDecimal getOtaPrice() { return otaPrice; }
    public void setOtaPrice(BigDecimal otaPrice) { this.otaPrice = otaPrice; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public Instant getDetectedAt() { return detectedAt; }
    public void setDetectedAt(Instant detectedAt) { this.detectedAt = detectedAt; }

    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }

    public Resolution getResolution() { return resolution; }
    public void setResolution(Resolution resolution) { this.resolution = resolution; }

    public String getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(String resolvedBy) { this.resolvedBy = resolvedBy; }
}
