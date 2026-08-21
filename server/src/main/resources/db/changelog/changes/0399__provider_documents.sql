-- Justificatifs professionnels des intervenants (menage, maintenance,
-- blanchisserie, exterieurs).
--
-- Une conciergerie qui fait travailler des independants DOIT collecter ces
-- pieces : l'absence d'attestation de vigilance expose le donneur d'ordre a la
-- solidarite financiere en cas de travail dissimule. Ce n'est pas un confort.
--
-- Le binaire vit dans PhotoStorageService (S3 ou BYTEA selon le profil) ; cette
-- table porte les metadonnees. Le document appartient a l'UTILISATEUR — un
-- independant travaille parfois pour plusieurs conciergeries avec les memes
-- pieces — et `organization_id` sert au cloisonnement de lecture cote
-- gestionnaire, pas a dupliquer le document.

CREATE TABLE IF NOT EXISTS provider_documents (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT       NOT NULL,
    organization_id   BIGINT,
    document_type     VARCHAR(40)  NOT NULL,
    storage_key       VARCHAR(512) NOT NULL,
    file_name         VARCHAR(255) NOT NULL,
    content_type      VARCHAR(100),
    file_size         BIGINT,
    -- Seule l'attestation de vigilance se perime d'office (6 mois) ; les autres
    -- pieces n'ont d'echeance que si l'emetteur en prevoit une.
    expires_at        DATE,
    status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    review_note       VARCHAR(500),
    reviewed_by       BIGINT,
    reviewed_at       TIMESTAMP,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_provider_documents_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_provider_documents_user ON provider_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_provider_documents_org ON provider_documents (organization_id);

COMMENT ON TABLE provider_documents IS
    'Justificatifs professionnels des intervenants (Kbis, vigilance URSSAF, RC pro, identite).';
COMMENT ON COLUMN provider_documents.expires_at IS
    'Date d''expiration declaree — obligatoire pour l''attestation de vigilance (validite 6 mois).';
