-- Accord commercial sans mission et historique des remplacements Baitly.
ALTER TABLE service_quote_cancellations ALTER COLUMN intervention_id DROP NOT NULL;
ALTER TABLE marketplace_quote_requests ADD COLUMN replaces_quote_id BIGINT
    REFERENCES service_quote_cancellations(quote_id);
ALTER TABLE marketplace_quote_requests
    ADD COLUMN requested_start_time TIME,
    ADD COLUMN requested_duration_minutes INTEGER CHECK (requested_duration_minutes > 0);
CREATE INDEX idx_marketplace_replaces_quote ON marketplace_quote_requests(replaces_quote_id)
    WHERE replaces_quote_id IS NOT NULL;
