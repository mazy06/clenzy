-- ============================================================================
-- 0178 : Comptes app Tuya par hote (modele C) + schema de l'App SDK
-- ============================================================================
-- Modele C (app mobile de marque) : chaque hote a un compte app Tuya provisionne
-- sous le schema du projet plateforme. Quand l'hote appaire un appareil dans l'app
-- Baitly (connecte a ce compte), l'appareil atterrit sur le projet plateforme et
-- devient decouvrable/segmentable par le PMS (claim registry).
--
-- - tuya_platform_config.app_schema : le schema de l'App SDK Tuya (console -> App SDK).
-- - tuya_app_account : mapping hote (keycloak user_id) -> compte app Tuya (uid + creds
--   chiffres). Un compte par hote (UNIQUE user_id).
-- ============================================================================

ALTER TABLE tuya_platform_config ADD COLUMN IF NOT EXISTS app_schema VARCHAR(255);

CREATE TABLE tuya_app_account (
    id                     BIGSERIAL PRIMARY KEY,
    organization_id        BIGINT,
    user_id                VARCHAR(255) NOT NULL,
    tuya_uid               VARCHAR(255),
    tuya_username          VARCHAR(255),
    tuya_secret_encrypted  TEXT,
    country_code           VARCHAR(8),
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP
);

CREATE UNIQUE INDEX uq_tuya_app_account_user ON tuya_app_account(user_id);
