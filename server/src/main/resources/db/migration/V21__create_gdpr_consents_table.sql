-- Migration V21: Creation de la table gdpr_consents
-- Date: 2026-02-11
-- Description: Table pour stocker les consentements RGPD des utilisateurs

CREATE TABLE IF NOT EXISTS gdpr_consents (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    consent_type VARCHAR(50) NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1,
    ip_address VARCHAR(45),
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_gdpr_consent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour recherche rapide par utilisateur
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_user_id ON gdpr_consents(user_id);
-- Index pour recherche par type de consentement
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_type ON gdpr_consents(consent_type);
-- Index composite pour la requete version la plus recente
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_user_type_version ON gdpr_consents(user_id, consent_type, version DESC);

-- Contrainte de check sur le type de consentement
ALTER TABLE gdpr_consents ADD CONSTRAINT chk_gdpr_consent_type
    CHECK (consent_type IN ('DATA_PROCESSING', 'MARKETING', 'ANALYTICS', 'THIRD_PARTY_SHARING', 'COOKIES'));

-- Log de la migration
DO $$
BEGIN
    RAISE NOTICE 'Migration V21 terminee : Table gdpr_consents creee';
END $$;
