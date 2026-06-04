-- ============================================================================
-- 0180 : Cles Android de l'App SDK Tuya (modele C)
-- ============================================================================
-- Correction de l'hypothese de 0179 : la console Tuya emet un couple AppKey/AppSecret
-- DISTINCT par plateforme (iOS vs Android), pas un couple partage. On conserve
-- app_key / app_secret_encrypted comme couple *iOS* et on ajoute le couple *Android*.
-- Secret chiffre AES-GCM cote tuya_platform_config, servi au mobile pour l'init du SDK.
-- ============================================================================

ALTER TABLE tuya_platform_config ADD COLUMN IF NOT EXISTS android_app_key VARCHAR(255);
ALTER TABLE tuya_platform_config ADD COLUMN IF NOT EXISTS android_app_secret_encrypted TEXT;
