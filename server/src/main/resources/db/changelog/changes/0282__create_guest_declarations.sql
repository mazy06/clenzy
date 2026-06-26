-- Fiche de police / declaration voyageur — entite DEDIEE (distincte du flux check-in online_checkins).
-- Une declaration par voyageur (principal + accompagnants). PII chiffrees AES-256 cote applicatif
-- (EncryptedFieldConverter) : colonnes VARCHAR(500) opaques, jamais de PII en clair en base.
-- Donnee soumise a purge 6 mois / 180 j (CESEDA R814-3) — cf. GuestDeclarationPurgeSource + RETENTION-POLICY.md.
-- Statut stocke en VARCHAR sans contrainte CHECK (cf. incident 0274 : les CHECK d'enum Hibernate gelaient
-- l'ajout de valeurs et provoquaient des bugs prod-only).
CREATE TABLE IF NOT EXISTS guest_declarations (
    id                    BIGSERIAL PRIMARY KEY,
    organization_id       BIGINT NOT NULL,
    reservation_id        BIGINT NOT NULL REFERENCES reservations (id),
    guest_id              BIGINT REFERENCES guests (id),
    is_primary            BOOLEAN NOT NULL DEFAULT TRUE,
    status                VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PII chiffrees AES-256 (texte chiffre Base64) — taille alignee sur online_checkins / guests.
    first_name            VARCHAR(500),
    last_name             VARCHAR(500),
    maiden_name           VARCHAR(500),
    birth_date            VARCHAR(500),
    birth_place           VARCHAR(500),
    nationality           VARCHAR(500),
    residence_address     VARCHAR(500),
    residence_country     VARCHAR(500),
    id_document_type      VARCHAR(500),
    id_document_number    VARCHAR(500),
    -- Juridiction de la fiche (FR/MA/SA) — non chiffre (routage / regles, pas une PII).
    country_code          VARCHAR(2),
    -- Soumission au teleservice (NON implementee dans cette phase).
    submitted_to_provider BOOLEAN NOT NULL DEFAULT FALSE,
    provider_type         VARCHAR(30),
    submitted_at          TIMESTAMP,
    created_at            TIMESTAMP NOT NULL,
    updated_at            TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_declaration_org ON guest_declarations (organization_id);
CREATE INDEX IF NOT EXISTS idx_guest_declaration_reservation ON guest_declarations (reservation_id);
-- Purge bornee par created_at (tri stable par id) — index pour le scan de retention.
CREATE INDEX IF NOT EXISTS idx_guest_declaration_created_at ON guest_declarations (created_at);
