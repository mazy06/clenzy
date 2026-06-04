-- ============================================================================
-- 0176 : Registre de reclamation des devices Tuya (garde-fou multi-tenant)
-- ============================================================================
-- Un device_id Tuya ne peut etre reclame que par UNE seule organisation (unicite
-- GLOBALE, volontairement NON org-scopee). Permet de segmenter les appareils par
-- organisation meme quand le compte Tuya est PARTAGE (compte par defaut Baitly/
-- Clenzy) : la decouverte masque les devices deja reclames par une autre org.
-- ============================================================================

CREATE TABLE tuya_device_claim (
    id                  BIGSERIAL PRIMARY KEY,
    tuya_device_id      VARCHAR(64) NOT NULL,
    organization_id     BIGINT NOT NULL,
    device_type         VARCHAR(20) NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Coeur du garde-fou : un device Tuya = une seule org (unicite GLOBALE, cross-org).
CREATE UNIQUE INDEX uq_tuya_claim_device_id ON tuya_device_claim(tuya_device_id);
CREATE INDEX idx_tuya_claim_org_id ON tuya_device_claim(organization_id);
