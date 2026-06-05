-- ============================================================================
-- 0182 : Codes d'acces des serrures connectees (mots de passe temporaires Tuya)
-- ============================================================================
-- Genere automatiquement a chaque reservation (fenetre check-in -> check-out+1)
-- ou manuellement depuis le hub. Le PIN (colonne "code") est CHIFFRE au repos
-- cote application (EncryptedFieldConverter) -> type TEXT (ciphertext). Aucune
-- recherche par valeur (lookup par device / reservation / status).
-- tuya_password_id : identifiant du mot de passe cote Tuya (pour revocation).
-- ============================================================================

CREATE TABLE smart_lock_access_code (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT,
    device_id           BIGINT NOT NULL,
    reservation_id      BIGINT,
    property_id         BIGINT NOT NULL,
    code                TEXT,
    tuya_password_id    VARCHAR(64),
    name                VARCHAR(255),
    valid_from          TIMESTAMP,
    valid_until         TIMESTAMP,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    source              VARCHAR(20) NOT NULL DEFAULT 'AUTO_RESERVATION',
    created_by          VARCHAR(255),
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP,
    revoked_at          TIMESTAMP,
    CONSTRAINT chk_slac_status CHECK (status IN ('ACTIVE','REVOKED','EXPIRED','FAILED')),
    CONSTRAINT chk_slac_source CHECK (source IN ('AUTO_RESERVATION','MANUAL'))
);

CREATE INDEX idx_slac_org ON smart_lock_access_code(organization_id);
CREATE INDEX idx_slac_device ON smart_lock_access_code(device_id);
CREATE INDEX idx_slac_reservation ON smart_lock_access_code(reservation_id);
CREATE INDEX idx_slac_property ON smart_lock_access_code(property_id);
CREATE INDEX idx_slac_status ON smart_lock_access_code(status);
CREATE INDEX idx_slac_created ON smart_lock_access_code(created_at DESC);
