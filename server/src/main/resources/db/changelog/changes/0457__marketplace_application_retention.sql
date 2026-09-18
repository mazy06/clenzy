-- Politique Baitly : 90 jours après notification du refus, sauf litige documenté.
ALTER TABLE marketplace_providers
    ADD COLUMN retention_hold_reason VARCHAR(1000),
    ADD COLUMN retention_hold_review_at TIMESTAMP,
    ADD COLUMN retention_hold_actor VARCHAR(120),
    ADD CONSTRAINT marketplace_retention_hold_complete CHECK (
        (retention_hold_reason IS NULL AND retention_hold_review_at IS NULL AND retention_hold_actor IS NULL)
        OR (length(trim(retention_hold_reason)) > 0 AND retention_hold_reason IS NOT NULL
            AND retention_hold_review_at IS NOT NULL AND retention_hold_actor IS NOT NULL));

CREATE INDEX idx_marketplace_refused_retention ON marketplace_providers (decision_sent_at, id)
    WHERE status = 'REJECTED' AND user_id IS NULL AND retention_hold_reason IS NULL;
