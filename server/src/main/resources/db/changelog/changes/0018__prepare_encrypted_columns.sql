-- Migration V22: Preparation des colonnes pour le chiffrement au repos (RGPD Article 32)
-- Date: 2026-02-11
-- Description: Elargit les colonnes sensibles pour accueillir les valeurs chiffrees AES-256
--              Le chiffrement AES-256 en Base64 produit des valeurs ~2.5x plus longues

-- ====================================================================
-- 1. Colonnes utilisateur (PII)
-- ====================================================================

-- phone_number: VARCHAR actuel potentiellement trop court pour AES-256
ALTER TABLE users ALTER COLUMN phone_number TYPE VARCHAR(500);

-- profile_picture_url: peut contenir une URL chiffree
ALTER TABLE users ALTER COLUMN profile_picture_url TYPE TEXT;

-- ====================================================================
-- 2. Colonnes GdprConsent
-- ====================================================================

-- ip_address chiffree pour conformite maximale
ALTER TABLE gdpr_consents ALTER COLUMN ip_address TYPE VARCHAR(500);

-- ====================================================================
-- 3. Colonnes AuditLog
-- ====================================================================

-- ip_address dans les logs d'audit
ALTER TABLE audit_log ALTER COLUMN ip_address TYPE VARCHAR(500);

-- ====================================================================
-- 4. Documentation: Colonnes deja chiffrees
-- ====================================================================
-- airbnb_connections.access_token_encrypted  → Chiffre AES-256 via AirbnbTokenEncryptionService
-- airbnb_connections.refresh_token_encrypted → Chiffre AES-256 via AirbnbTokenEncryptionService
-- users.password                            → Hash bcrypt (pas de chiffrement reversible)

-- ====================================================================
-- Log de la migration
-- ====================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration V22 terminee : Colonnes sensibles preparees pour le chiffrement au repos (RGPD Article 32)';
END $$;
