package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Ligne du journal des ajustements yield v1 (F8a) — replay complet possible.
 *
 * <p>Une ligne par (bien, date tarifaire, jour d'évaluation) : prix avant /
 * après (ou proposé selon le {@link Mode}), occupation constatée + seuil.
 * Les non-actions sont AUSSI journalisées ({@code skipReason} : NO_BOUNDS,
 * DAILY_CAP_REACHED, EVALUATION_ERROR — {@code targetDate} nulle dans ce cas).</p>
 *
 * <p>Un index unique partiel DB (property_id, target_date, adjustment_day)
 * WHERE mode = 'APPLIED' garantit qu'un tarif n'est appliqué qu'une fois par
 * jour calendaire (protection concurrence, pas de check-then-act nu).</p>
 */
@Entity
@Table(name = "yield_adjustments")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class YieldAdjustment {

    /** Mode de la ligne : reflet du {@link YieldMode} de l'org au moment du run. */
    public enum Mode {
        SIMULATED,
        SUGGESTED,
        APPLIED
    }

    public static final String SKIP_NO_BOUNDS = "NO_BOUNDS";
    public static final String SKIP_DAILY_CAP_REACHED = "DAILY_CAP_REACHED";
    public static final String SKIP_EVALUATION_ERROR = "EVALUATION_ERROR";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "rule_id")
    private Long ruleId;

    /** Date tarifaire concernée (nuit ajustée) — nulle pour une ligne de skip. */
    @Column(name = "target_date")
    private LocalDate targetDate;

    /** Jour calendaire de l'évaluation, dans la timezone du bien (cap journalier). */
    @Column(name = "adjustment_day", nullable = false)
    private LocalDate adjustmentDay;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode", length = 20, nullable = false)
    private Mode mode;

    @Column(name = "price_before", precision = 10, scale = 2)
    private BigDecimal priceBefore;

    @Column(name = "price_after", precision = 10, scale = 2)
    private BigDecimal priceAfter;

    @Column(name = "occupancy_pct", precision = 5, scale = 2)
    private BigDecimal occupancyPct;

    @Column(name = "threshold_pct", precision = 5, scale = 2)
    private BigDecimal thresholdPct;

    @Column(name = "comparison", length = 10)
    private String comparison;

    @Column(name = "reason", length = 300)
    private String reason;

    /** Lien vers la suggestion HITL créée en mode SUGGEST. */
    @Column(name = "suggestion_id")
    private Long suggestionId;

    @Column(name = "skip_reason", length = 40)
    private String skipReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private Instant createdAt;

    public YieldAdjustment() {}

    public YieldAdjustment(Long organizationId, Long propertyId, LocalDate adjustmentDay, Mode mode) {
        this.organizationId = organizationId;
        this.propertyId = propertyId;
        this.adjustmentDay = adjustmentDay;
        this.mode = mode;
    }

    public Long getId() { return id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public Long getRuleId() { return ruleId; }
    public void setRuleId(Long ruleId) { this.ruleId = ruleId; }

    public LocalDate getTargetDate() { return targetDate; }
    public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; }

    public LocalDate getAdjustmentDay() { return adjustmentDay; }
    public void setAdjustmentDay(LocalDate adjustmentDay) { this.adjustmentDay = adjustmentDay; }

    public Mode getMode() { return mode; }
    public void setMode(Mode mode) { this.mode = mode; }

    public BigDecimal getPriceBefore() { return priceBefore; }
    public void setPriceBefore(BigDecimal priceBefore) { this.priceBefore = priceBefore; }

    public BigDecimal getPriceAfter() { return priceAfter; }
    public void setPriceAfter(BigDecimal priceAfter) { this.priceAfter = priceAfter; }

    public BigDecimal getOccupancyPct() { return occupancyPct; }
    public void setOccupancyPct(BigDecimal occupancyPct) { this.occupancyPct = occupancyPct; }

    public BigDecimal getThresholdPct() { return thresholdPct; }
    public void setThresholdPct(BigDecimal thresholdPct) { this.thresholdPct = thresholdPct; }

    public String getComparison() { return comparison; }
    public void setComparison(String comparison) { this.comparison = comparison; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public Long getSuggestionId() { return suggestionId; }
    public void setSuggestionId(Long suggestionId) { this.suggestionId = suggestionId; }

    public String getSkipReason() { return skipReason; }
    public void setSkipReason(String skipReason) { this.skipReason = skipReason; }

    public Instant getCreatedAt() { return createdAt; }
}
