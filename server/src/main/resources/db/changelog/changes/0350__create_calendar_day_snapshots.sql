-- Fondations RMS (R1) : photo quotidienne du calendrier publie (prix resolu par la
-- cascade PriceEngine + statut + min_stay) sur un horizon glissant de 365 jours.
-- Contrairement a calendar_days (etat courant ecrase, absence de ligne = disponible),
-- cette table est APPEND-ONLY et permet de reconstruire les prix affiches dans le
-- temps (booking curve prix, forecast R3). Retention : 400 j pleine granularite puis
-- compaction hebdomadaire (SnapshotRetentionScheduler).
CREATE TABLE calendar_day_snapshots (
    organization_id BIGINT       NOT NULL,
    property_id     BIGINT       NOT NULL,
    stay_date       DATE         NOT NULL,
    snapshot_date   DATE         NOT NULL,
    published_price NUMERIC(10,2),
    currency        VARCHAR(3),
    price_source    VARCHAR(32)  NOT NULL,
    status          VARCHAR(20)  NOT NULL,
    min_stay        INTEGER,
    created_at      TIMESTAMP    NOT NULL DEFAULT now(),
    PRIMARY KEY (property_id, stay_date, snapshot_date)
);

-- Lectures « photo d'un jour » (pace) et purge/compaction : BRIN suffit, la table
-- est inseree en ordre chronologique de snapshot_date.
CREATE INDEX idx_cds_snapshot_date ON calendar_day_snapshots USING brin (snapshot_date);
CREATE INDEX idx_cds_org ON calendar_day_snapshots (organization_id);
