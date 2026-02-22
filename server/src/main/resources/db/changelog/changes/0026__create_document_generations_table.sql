-- ============================================================
-- V30 : Table de suivi des documents generes
-- ============================================================

CREATE TABLE document_generations (
    id                  BIGSERIAL PRIMARY KEY,
    template_id         BIGINT REFERENCES document_templates(id),
    document_type       VARCHAR(50) NOT NULL,
    reference_id        BIGINT,
    reference_type      VARCHAR(50),
    user_id             VARCHAR(100),
    user_email          VARCHAR(255),
    file_path           VARCHAR(500),
    file_name           VARCHAR(255),
    file_size           BIGINT,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    email_to            VARCHAR(255),
    email_status        VARCHAR(20),
    email_sent_at       TIMESTAMP,
    error_message       TEXT,
    generation_time_ms  INTEGER,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Statuts de base ; LOCKED et ARCHIVED ajoutes en V31
    CONSTRAINT chk_gen_status CHECK (status IN (
        'PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'SENT'
    )),
    CONSTRAINT chk_email_status CHECK (email_status IS NULL OR email_status IN (
        'PENDING', 'SENT', 'FAILED', 'SKIPPED'
    ))
);

CREATE INDEX idx_doc_generations_type ON document_generations(document_type, created_at DESC);
CREATE INDEX idx_doc_generations_ref ON document_generations(reference_type, reference_id);
CREATE INDEX idx_doc_generations_user ON document_generations(user_id, created_at DESC);
CREATE INDEX idx_doc_generations_status ON document_generations(status);

-- Permissions pour le module documents
INSERT INTO permissions (name, description, module) VALUES
    ('documents:view', 'Voir les templates et les documents generes', 'documents'),
    ('documents:manage', 'Gerer les templates de documents', 'documents'),
    ('documents:generate', 'Generer des documents manuellement', 'documents')
ON CONFLICT (name) DO NOTHING;
