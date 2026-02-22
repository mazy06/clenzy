-- V56: Table pour stocker les snapshots periodiques des 12 KPIs de certification.
-- Chaque snapshot capture l'etat des KPIs a un instant T.
-- Retention de 6 mois, purge par DataRetentionService.

CREATE TABLE kpi_snapshots (
    id                              BIGSERIAL PRIMARY KEY,
    captured_at                     TIMESTAMP      NOT NULL DEFAULT now(),
    readiness_score                 DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
    critical_failed                 BOOLEAN        NOT NULL DEFAULT false,
    uptime_pct                      DECIMAL(6,3),
    calendar_latency_p95_ms         DECIMAL(10,2),
    sync_error_rate_pct             DECIMAL(5,2),
    inventory_coherence_pct         DECIMAL(6,3),
    double_bookings                 INT NOT NULL DEFAULT 0,
    api_latency_p95_ms              DECIMAL(10,2),
    sync_availability_pct           DECIMAL(6,3),
    p1_resolution_minutes           DECIMAL(8,2),
    kafka_consumer_lag              BIGINT,
    outbox_drain_time_ms            DECIMAL(10,2),
    reconciliation_divergence_pct   DECIMAL(5,2),
    test_coverage_pct               DECIMAL(5,2),
    metrics_detail                  JSONB,
    source                          VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
);

CREATE INDEX idx_kpi_snapshots_captured ON kpi_snapshots(captured_at DESC);
CREATE INDEX idx_kpi_snapshots_score ON kpi_snapshots(readiness_score);
