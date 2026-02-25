-- V60: Store contact message attachments in database (bytea) instead of filesystem
-- This ensures attachments are backed up with the database and simplifies mobile access.

CREATE TABLE contact_attachment_files (
    id             BIGSERIAL PRIMARY KEY,
    message_id     BIGINT NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
    attachment_id  VARCHAR(36) NOT NULL,
    data           BYTEA NOT NULL,
    content_type   VARCHAR(100),
    original_name  VARCHAR(500),
    size           BIGINT,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attachment_file UNIQUE (message_id, attachment_id)
);

CREATE INDEX idx_attachment_files_message ON contact_attachment_files(message_id);
