-- Roadmap market data (Phase 0) : benchmarks de marche persistes, multi-sources
-- (FIRST_PARTY / OPEN_DATA / AIRBTICS / AIRROI), append-only historises par
-- snapshot_date. Ecrit par l'ingestion quotidienne (MarketDataIngestionScheduler),
-- lu par les consommateurs RMS. Vie privee : les cellules FIRST_PARTY sont des
-- agregats k-anonymes (sample_size >= 5, garanti en SQL a la source) sans aucun
-- identifiant de bien ni de tenant ; organization_id null = benchmark plateforme.
CREATE TABLE market_data_snapshots (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT,
    area            VARCHAR(120) NOT NULL,
    country_code    VARCHAR(2),
    source          VARCHAR(24)  NOT NULL,
    snapshot_date   DATE         NOT NULL,
    stay_month      VARCHAR(7)   NOT NULL,
    adr             NUMERIC(12,2),
    occupancy_pct   NUMERIC(5,2),
    revpar          NUMERIC(12,2),
    currency        VARCHAR(3),
    sample_size     INTEGER      NOT NULL,
    confidence      NUMERIC(3,2) NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_mds_area_month ON market_data_snapshots (area, stay_month);
CREATE INDEX idx_mds_source_date ON market_data_snapshots (source, snapshot_date);
