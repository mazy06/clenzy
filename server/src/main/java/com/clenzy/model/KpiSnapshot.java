package com.clenzy.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Snapshot periodique des 12 KPI de certification Airbnb Partner.
 *
 * Chaque snapshot capture l'etat des indicateurs a un instant T.
 * Le score de readiness est calcule a partir des poids et seuils
 * definis dans KpiService.
 *
 * PAS de @Filter("organizationFilter") : consultable cross-org par SUPER_ADMIN.
 */
@Entity
@Table(name = "kpi_snapshots")
public class KpiSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "captured_at", nullable = false)
    private LocalDateTime capturedAt = LocalDateTime.now();

    @Column(name = "readiness_score", nullable = false, precision = 5, scale = 2)
    private BigDecimal readinessScore = BigDecimal.ZERO;

    @Column(name = "critical_failed", nullable = false)
    private boolean criticalFailed = false;

    // ── 12 KPI values ────────────────────────────────────────────────────────

    @Column(name = "uptime_pct", precision = 6, scale = 3)
    private BigDecimal uptimePct;

    @Column(name = "calendar_latency_p95_ms", precision = 10, scale = 2)
    private BigDecimal calendarLatencyP95Ms;

    @Column(name = "sync_error_rate_pct", precision = 5, scale = 2)
    private BigDecimal syncErrorRatePct;

    @Column(name = "inventory_coherence_pct", precision = 6, scale = 3)
    private BigDecimal inventoryCoherencePct;

    @Column(name = "double_bookings", nullable = false)
    private int doubleBookings = 0;

    @Column(name = "api_latency_p95_ms", precision = 10, scale = 2)
    private BigDecimal apiLatencyP95Ms;

    @Column(name = "sync_availability_pct", precision = 6, scale = 3)
    private BigDecimal syncAvailabilityPct;

    @Column(name = "p1_resolution_minutes", precision = 8, scale = 2)
    private BigDecimal p1ResolutionMinutes;

    @Column(name = "kafka_consumer_lag")
    private Long kafkaConsumerLag;

    @Column(name = "outbox_drain_time_ms", precision = 10, scale = 2)
    private BigDecimal outboxDrainTimeMs;

    @Column(name = "reconciliation_divergence_pct", precision = 5, scale = 2)
    private BigDecimal reconciliationDivergencePct;

    @Column(name = "test_coverage_pct", precision = 5, scale = 2)
    private BigDecimal testCoveragePct;

    // ── Metadata ─────────────────────────────────────────────────────────────

    @Column(name = "metrics_detail", columnDefinition = "JSONB")
    private String metricsDetail;

    /** SCHEDULED, MANUAL, STARTUP */
    @Column(name = "source", nullable = false, length = 20)
    private String source = "SCHEDULED";

    // Constructeurs

    public KpiSnapshot() {}

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getCapturedAt() { return capturedAt; }
    public void setCapturedAt(LocalDateTime capturedAt) { this.capturedAt = capturedAt; }

    public BigDecimal getReadinessScore() { return readinessScore; }
    public void setReadinessScore(BigDecimal readinessScore) { this.readinessScore = readinessScore; }

    public boolean isCriticalFailed() { return criticalFailed; }
    public void setCriticalFailed(boolean criticalFailed) { this.criticalFailed = criticalFailed; }

    public BigDecimal getUptimePct() { return uptimePct; }
    public void setUptimePct(BigDecimal uptimePct) { this.uptimePct = uptimePct; }

    public BigDecimal getCalendarLatencyP95Ms() { return calendarLatencyP95Ms; }
    public void setCalendarLatencyP95Ms(BigDecimal calendarLatencyP95Ms) { this.calendarLatencyP95Ms = calendarLatencyP95Ms; }

    public BigDecimal getSyncErrorRatePct() { return syncErrorRatePct; }
    public void setSyncErrorRatePct(BigDecimal syncErrorRatePct) { this.syncErrorRatePct = syncErrorRatePct; }

    public BigDecimal getInventoryCoherencePct() { return inventoryCoherencePct; }
    public void setInventoryCoherencePct(BigDecimal inventoryCoherencePct) { this.inventoryCoherencePct = inventoryCoherencePct; }

    public int getDoubleBookings() { return doubleBookings; }
    public void setDoubleBookings(int doubleBookings) { this.doubleBookings = doubleBookings; }

    public BigDecimal getApiLatencyP95Ms() { return apiLatencyP95Ms; }
    public void setApiLatencyP95Ms(BigDecimal apiLatencyP95Ms) { this.apiLatencyP95Ms = apiLatencyP95Ms; }

    public BigDecimal getSyncAvailabilityPct() { return syncAvailabilityPct; }
    public void setSyncAvailabilityPct(BigDecimal syncAvailabilityPct) { this.syncAvailabilityPct = syncAvailabilityPct; }

    public BigDecimal getP1ResolutionMinutes() { return p1ResolutionMinutes; }
    public void setP1ResolutionMinutes(BigDecimal p1ResolutionMinutes) { this.p1ResolutionMinutes = p1ResolutionMinutes; }

    public Long getKafkaConsumerLag() { return kafkaConsumerLag; }
    public void setKafkaConsumerLag(Long kafkaConsumerLag) { this.kafkaConsumerLag = kafkaConsumerLag; }

    public BigDecimal getOutboxDrainTimeMs() { return outboxDrainTimeMs; }
    public void setOutboxDrainTimeMs(BigDecimal outboxDrainTimeMs) { this.outboxDrainTimeMs = outboxDrainTimeMs; }

    public BigDecimal getReconciliationDivergencePct() { return reconciliationDivergencePct; }
    public void setReconciliationDivergencePct(BigDecimal reconciliationDivergencePct) { this.reconciliationDivergencePct = reconciliationDivergencePct; }

    public BigDecimal getTestCoveragePct() { return testCoveragePct; }
    public void setTestCoveragePct(BigDecimal testCoveragePct) { this.testCoveragePct = testCoveragePct; }

    public String getMetricsDetail() { return metricsDetail; }
    public void setMetricsDetail(String metricsDetail) { this.metricsDetail = metricsDetail; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    @Override
    public String toString() {
        return "KpiSnapshot{id=" + id + ", capturedAt=" + capturedAt
                + ", readinessScore=" + readinessScore + ", criticalFailed=" + criticalFailed
                + ", source='" + source + "'}";
    }
}
