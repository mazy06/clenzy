-- ============================================================
-- V31 : Conformite NF Documents
-- Numerotation sequentielle, mentions legales, immutabilite,
-- rapports de conformite
-- ============================================================

-- ─── 1. Nouvelles colonnes sur document_generations ─────────

ALTER TABLE document_generations
    ADD COLUMN IF NOT EXISTS legal_number   VARCHAR(50),
    ADD COLUMN IF NOT EXISTS document_hash  VARCHAR(128),
    ADD COLUMN IF NOT EXISTS locked         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS locked_at      TIMESTAMP,
    ADD COLUMN IF NOT EXISTS corrects_id    BIGINT REFERENCES document_generations(id);

CREATE UNIQUE INDEX idx_doc_gen_legal_number ON document_generations(legal_number) WHERE legal_number IS NOT NULL;
CREATE INDEX idx_doc_gen_corrects ON document_generations(corrects_id) WHERE corrects_id IS NOT NULL;
CREATE INDEX idx_doc_gen_locked ON document_generations(locked) WHERE locked = TRUE;

-- Autoriser les nouveaux statuts
ALTER TABLE document_generations DROP CONSTRAINT IF EXISTS chk_gen_status;
ALTER TABLE document_generations ADD CONSTRAINT chk_gen_status CHECK (status IN (
    'PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'SENT', 'LOCKED', 'ARCHIVED'
));

-- ─── 2. Sequences de numerotation ──────────────────────────

CREATE TABLE document_number_sequences (
    id              BIGSERIAL PRIMARY KEY,
    document_type   VARCHAR(50)  NOT NULL,
    year            INTEGER      NOT NULL,
    prefix          VARCHAR(20)  NOT NULL,
    last_number     INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_doc_num_seq_type_year UNIQUE (document_type, year)
);

CREATE INDEX idx_doc_num_seq_type_year ON document_number_sequences(document_type, year);

-- ─── 3. Mentions legales obligatoires ───────────────────────

CREATE TABLE document_legal_requirements (
    id                BIGSERIAL PRIMARY KEY,
    document_type     VARCHAR(50)  NOT NULL,
    requirement_key   VARCHAR(100) NOT NULL,
    label             VARCHAR(255) NOT NULL,
    description       TEXT,
    required          BOOLEAN      NOT NULL DEFAULT TRUE,
    default_value     TEXT,
    display_order     INTEGER      NOT NULL DEFAULT 0,
    active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(document_type, requirement_key)
);

CREATE INDEX idx_doc_legal_req_type ON document_legal_requirements(document_type, active);

-- ─── 4. Rapports de conformite templates ────────────────────

CREATE TABLE template_compliance_reports (
    id                BIGSERIAL PRIMARY KEY,
    template_id       BIGINT       NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    compliant         BOOLEAN      NOT NULL,
    checked_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    checked_by        VARCHAR(255),
    missing_tags      TEXT,
    missing_mentions  TEXT,
    warnings          TEXT,
    score             INTEGER      DEFAULT 0
);

CREATE INDEX idx_compliance_report_template ON template_compliance_reports(template_id, checked_at DESC);

-- ─── 5. Donnees initiales : mentions legales ────────────────

-- FACTURE (7 mentions obligatoires NF)
INSERT INTO document_legal_requirements (document_type, requirement_key, label, description, required, default_value, display_order) VALUES
    ('FACTURE', 'numero_facture', 'Numero de facture', 'Numero sequentiel unique et sans trou (tag: nf.numero_legal)', TRUE, NULL, 1),
    ('FACTURE', 'date_emission', 'Date d''emission', 'Date de creation de la facture (tag: nf.date_emission)', TRUE, NULL, 2),
    ('FACTURE', 'identite_vendeur', 'Identite du vendeur', 'Nom, adresse, SIRET de l''entreprise (tags: entreprise.*)', TRUE, NULL, 3),
    ('FACTURE', 'identite_acheteur', 'Identite de l''acheteur', 'Nom et adresse du client (tags: client.*)', TRUE, NULL, 4),
    ('FACTURE', 'designation_prestations', 'Designation des prestations', 'Description detaillee des services rendus (tags: intervention.*)', TRUE, NULL, 5),
    ('FACTURE', 'montant_total', 'Montant total', 'Montant HT, TVA et TTC (tags: paiement.montant)', TRUE, NULL, 6),
    ('FACTURE', 'conditions_paiement', 'Conditions de paiement', 'Delai de paiement, penalites de retard (tag: nf.conditions_paiement)', TRUE, 'Paiement a reception. Penalites de retard : 3 fois le taux d''interet legal.', 7)
ON CONFLICT (document_type, requirement_key) DO NOTHING;

-- DEVIS (5 mentions obligatoires)
INSERT INTO document_legal_requirements (document_type, requirement_key, label, description, required, default_value, display_order) VALUES
    ('DEVIS', 'numero_devis', 'Numero de devis', 'Numero sequentiel unique (tag: nf.numero_legal)', TRUE, NULL, 1),
    ('DEVIS', 'date_emission', 'Date d''emission', 'Date de creation du devis (tag: nf.date_emission)', TRUE, NULL, 2),
    ('DEVIS', 'identite_vendeur', 'Identite du prestataire', 'Nom, adresse, SIRET de l''entreprise (tags: entreprise.*)', TRUE, NULL, 3),
    ('DEVIS', 'designation_prestations', 'Designation des prestations', 'Description detaillee et prix unitaires (tags: intervention.*)', TRUE, NULL, 4),
    ('DEVIS', 'duree_validite', 'Duree de validite', 'Duree pendant laquelle le devis est valable (tag: nf.duree_validite)', TRUE, 'Ce devis est valable 30 jours a compter de sa date d''emission.', 5)
ON CONFLICT (document_type, requirement_key) DO NOTHING;

-- BON_INTERVENTION (3 mentions obligatoires)
INSERT INTO document_legal_requirements (document_type, requirement_key, label, description, required, default_value, display_order) VALUES
    ('BON_INTERVENTION', 'identite_intervenant', 'Identite de l''intervenant', 'Nom du technicien et de l''entreprise (tags: technicien.*, entreprise.*)', TRUE, NULL, 1),
    ('BON_INTERVENTION', 'description_travaux', 'Description des travaux', 'Nature et detail de l''intervention (tags: intervention.*)', TRUE, NULL, 2),
    ('BON_INTERVENTION', 'date_intervention', 'Date de l''intervention', 'Date et heure de debut/fin (tags: intervention.date_debut, intervention.date_fin)', TRUE, NULL, 3)
ON CONFLICT (document_type, requirement_key) DO NOTHING;

-- ─── 6. Index composites pour les requetes frequentes ─────
CREATE INDEX IF NOT EXISTS idx_doc_gen_status_created ON document_generations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_gen_locked_type ON document_generations(locked, document_type, created_at DESC) WHERE locked = TRUE;

-- Permission conformite
INSERT INTO permissions (name, description, module) VALUES
    ('documents:compliance', 'Voir et gerer la conformite NF des documents', 'documents')
ON CONFLICT (name) DO NOTHING;
