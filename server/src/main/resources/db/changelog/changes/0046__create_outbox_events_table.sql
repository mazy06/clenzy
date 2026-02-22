-- ============================================================================
-- V50 : Creation de la table outbox_events (Transactional Outbox Pattern)
-- ============================================================================
-- Garantit la coherence entre les mutations en base et les messages Kafka.
-- Les events sont ecrits dans la meme transaction que la mutation,
-- puis relaye vers Kafka par un poller asynchrone.
-- ============================================================================

CREATE TABLE outbox_events (
    id              BIGSERIAL PRIMARY KEY,
    aggregate_type  VARCHAR(50) NOT NULL,
    aggregate_id    VARCHAR(100) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    topic           VARCHAR(100) NOT NULL,
    partition_key   VARCHAR(100),
    payload         JSONB NOT NULL,
    organization_id BIGINT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','SENT','FAILED')),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    sent_at         TIMESTAMP,
    error_message   TEXT
);

-- Index pour le poller : recuperer les events PENDING par ordre de creation
CREATE INDEX idx_outbox_events_status_created ON outbox_events(status, created_at)
    WHERE status = 'PENDING';

-- Index pour les requetes par aggregate (debug, audit)
CREATE INDEX idx_outbox_events_aggregate ON outbox_events(aggregate_type, aggregate_id);

-- Ajout du champ max_stay dans calendar_days (G3 - restrictions formelles)
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS max_stay INTEGER;

-- Ajout du champ changeover_day dans calendar_days
-- (jour de changement : jour ou le checkout et le check-in se font le meme jour)
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS changeover_day BOOLEAN DEFAULT true;
