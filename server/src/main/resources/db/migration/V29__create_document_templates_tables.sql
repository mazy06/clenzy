-- ============================================================
-- V29 : Tables pour le moteur de generation de documents
-- ============================================================

-- Table des templates de documents
CREATE TABLE document_templates (
    id                BIGSERIAL PRIMARY KEY,
    name              VARCHAR(200) NOT NULL,
    description       TEXT,
    document_type     VARCHAR(50) NOT NULL,
    event_trigger     VARCHAR(100),
    file_path         VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    email_subject     VARCHAR(255),
    email_body        TEXT,
    created_by        VARCHAR(100),
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_doc_type CHECK (document_type IN (
        'DEVIS', 'FACTURE', 'MANDAT_GESTION', 'AUTORISATION_TRAVAUX',
        'BON_INTERVENTION', 'VALIDATION_FIN_MISSION',
        'JUSTIFICATIF_PAIEMENT', 'JUSTIFICATIF_REMBOURSEMENT'
    ))
);

-- Un seul template actif par type de document
CREATE UNIQUE INDEX idx_document_templates_active_type
    ON document_templates(document_type) WHERE active = TRUE;

CREATE INDEX idx_document_templates_type
    ON document_templates(document_type, active);

-- Table des tags detectes dans les templates
CREATE TABLE document_template_tags (
    id            BIGSERIAL PRIMARY KEY,
    template_id   BIGINT NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    tag_name      VARCHAR(200) NOT NULL,
    tag_category  VARCHAR(50) NOT NULL,
    data_source   VARCHAR(200),
    description   VARCHAR(500),
    tag_type      VARCHAR(20) NOT NULL DEFAULT 'SIMPLE',
    required      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_tag_category CHECK (tag_category IN (
        'CLIENT', 'PROPERTY', 'INTERVENTION', 'DEVIS',
        'FACTURE', 'PAIEMENT', 'ENTREPRISE', 'SYSTEM'
    )),
    CONSTRAINT chk_tag_type CHECK (tag_type IN (
        'SIMPLE', 'LIST', 'CONDITIONAL', 'DATE', 'MONEY', 'IMAGE'
    )),
    CONSTRAINT uq_template_tag UNIQUE (template_id, tag_name)
);

CREATE INDEX idx_template_tags_template
    ON document_template_tags(template_id);
