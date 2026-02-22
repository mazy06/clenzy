-- V55: Table pour stocker les resultats des runs de reconciliation calendrier.
-- Chaque run compare le calendrier PMS (source de verite) avec le calendrier
-- cote channel pour un mapping donne, detecte les divergences et les corrige.

CREATE TABLE reconciliation_runs (
    id                   BIGSERIAL PRIMARY KEY,
    channel              VARCHAR(30)    NOT NULL,
    property_id          BIGINT         NOT NULL,
    organization_id      BIGINT         NOT NULL,
    started_at           TIMESTAMP      NOT NULL DEFAULT now(),
    completed_at         TIMESTAMP,
    status               VARCHAR(20)    NOT NULL DEFAULT 'RUNNING',
    pms_days_checked     INT            NOT NULL DEFAULT 0,
    channel_days_checked INT            NOT NULL DEFAULT 0,
    discrepancies_found  INT            NOT NULL DEFAULT 0,
    discrepancies_fixed  INT            NOT NULL DEFAULT 0,
    divergence_pct       DECIMAL(5,2)   DEFAULT 0.00,
    details              JSONB,
    error_message        TEXT
);

CREATE INDEX idx_recon_runs_channel_status ON reconciliation_runs(channel, status);
CREATE INDEX idx_recon_runs_property       ON reconciliation_runs(property_id);
CREATE INDEX idx_recon_runs_started        ON reconciliation_runs(started_at DESC);
