-- ============================================================================
-- 0179 : Cles de l'App SDK Tuya mobile (modele C)
-- ============================================================================
-- L'App SDK Tuya (Smart Life App SDK) fournit UN couple AppKey/AppSecret pour l'app
-- (partage iOS + Android ; seuls bundleId/package + SHA-256 different par plateforme).
-- Stockes en base (secret chiffre AES-GCM) cote tuya_platform_config, servis au mobile
-- pour l'init du SDK avant l'appairage.
-- ============================================================================

ALTER TABLE tuya_platform_config ADD COLUMN IF NOT EXISTS app_key VARCHAR(255);
ALTER TABLE tuya_platform_config ADD COLUMN IF NOT EXISTS app_secret_encrypted TEXT;
