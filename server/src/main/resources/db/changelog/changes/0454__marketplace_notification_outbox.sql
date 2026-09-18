-- Baitly : intent d'envoi enregistré avec la mutation métier.
CREATE TABLE marketplace_notification_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider_id bigint NOT NULL REFERENCES marketplace_providers(id) ON DELETE CASCADE,
 kind varchar(40) NOT NULL CHECK (kind IN ('CONFIRMATION','APPLICATION_EMAIL','APPLICATION_STAFF','DOCUMENT_STAFF','DECISION')),
 encrypted_payload text,
 expected_status varchar(30),
 actor varchar(100),
 status varchar(12) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RUNNING','SENT','CANCELLED')),
 attempts integer NOT NULL DEFAULT 0,
 claim_token uuid,
 created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 next_attempt_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 sent_at timestamp
);
CREATE INDEX idx_marketplace_notification_due ON marketplace_notification_deliveries(next_attempt_at,id)
 WHERE status IN ('PENDING','RUNNING');
CREATE INDEX idx_marketplace_notification_provider ON marketplace_notification_deliveries(provider_id,created_at);
