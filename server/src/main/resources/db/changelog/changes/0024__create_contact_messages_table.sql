-- ============================================================
-- V28 : Table des messages de contact (inbox / sent / archived)
-- ============================================================

CREATE TABLE contact_messages (
    id                    BIGSERIAL PRIMARY KEY,
    sender_keycloak_id    VARCHAR(100) NOT NULL,
    sender_first_name     VARCHAR(100) NOT NULL,
    sender_last_name      VARCHAR(100) NOT NULL,
    sender_email          VARCHAR(255) NOT NULL,
    recipient_keycloak_id VARCHAR(100) NOT NULL,
    recipient_first_name  VARCHAR(100) NOT NULL,
    recipient_last_name   VARCHAR(100) NOT NULL,
    recipient_email       VARCHAR(255) NOT NULL,
    subject               VARCHAR(255) NOT NULL,
    message               TEXT NOT NULL,
    priority              VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    category              VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
    status                VARCHAR(20) NOT NULL DEFAULT 'SENT',
    is_archived           BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at           TIMESTAMP,
    delivered_at          TIMESTAMP,
    read_at               TIMESTAMP,
    replied_at            TIMESTAMP,
    provider_message_id   VARCHAR(255),
    attachments           JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_contact_priority
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT chk_contact_category
        CHECK (category IN ('GENERAL', 'TECHNICAL', 'MAINTENANCE', 'CLEANING', 'EMERGENCY')),
    CONSTRAINT chk_contact_status
        CHECK (status IN ('SENT', 'DELIVERED', 'READ', 'REPLIED'))
);

CREATE INDEX idx_contact_messages_inbox
    ON contact_messages(recipient_keycloak_id, is_archived, created_at DESC);

CREATE INDEX idx_contact_messages_sent
    ON contact_messages(sender_keycloak_id, is_archived, created_at DESC);

CREATE INDEX idx_contact_messages_archived
    ON contact_messages(is_archived, created_at DESC);
