-- Équipe figée à la demande et reprise durable des publications de discussion.
ALTER TABLE marketplace_quote_requests ADD COLUMN provider_team_id BIGINT REFERENCES teams(id);
ALTER TABLE marketplace_quote_requests ADD COLUMN discussion_published_status VARCHAR(20);
ALTER TABLE marketplace_quote_requests ADD COLUMN discussion_retry_at TIMESTAMP;
-- Les anciennes demandes ne sont pas annoncées rétroactivement en masse.
UPDATE marketplace_quote_requests SET discussion_published_status = status;
CREATE INDEX idx_marketplace_quote_discussion_pending ON marketplace_quote_requests (id)
    WHERE discussion_published_status IS DISTINCT FROM status;
